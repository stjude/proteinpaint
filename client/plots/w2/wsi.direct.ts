/*
 Direct whole-slide viewer for a single file, launched via runpp URL param:
   http://localhost:3000/?image_file=SVS/slide.svs
 The format (SVS, OME-TIFF, ...) is deduced from the file extension,
 case-insensitively, by the server (wsi_tile.py open_slide()).

 All spatial companion data comes from ONE consolidated .h5ad (like the slide,
 the path is relative to serverconfig.tpmasterdir):
   &spatial_data=SVS/spatial.h5ad
 It supplies the cell/nucleus boundary polygons (drawn as strokes), the
 per-cell cell_type annotations, and the gene expression matrix — the server
 derives each piece from it (see wsitiles.ts).

 &cell_types=1 fills every annotated cell by its type. To fill only some
 types, pass a JSON array — &cell_types=["Tumor","T cell, activated"] — the
 unambiguous form, since type names are free text and may contain commas; a
 bare comma list (&cell_types=Tumor,B cells) also works for names without
 commas. Colors are assigned over all types, so a type keeps its color
 across filters.

 &annotation_level=n limits the boundary strokes to the n most zoomed-in levels
 of the viewer: zoomed out beyond that, the boundaries are hidden. Omit to
 always show. Gene expression fills are not affected — they show at all zooms.

 While the boundaries are visible (within annotation_level), hovering over a
 cell shows a tooltip with its id, its cell_type (when annotated), and its
 per-gene transcript counts (when genes are loaded).

 Gene expression overlay: &gene_expression=ACE2,ACTA2 draws one fill overlay
 per comma-separated gene, each in its own color (see GENE_COLORS), shaded by
 that gene's transcript count in the cell. A legend overlaid on the map's
 top-right corner shows each gene's color gradient and count range; cells
 expressing several genes blend their fills.
 An unknown gene name surfaces an error in the UI (other genes still render).
 When the cell-type overlay is shown, expression fills/legend are suppressed
 (never both fills at once) — counts still appear in the hover tooltip.

 &gene_groups=g1,g2,g3 instead sums each cell's counts over all listed genes
 and draws ONE overlay of the totals in a single color. Can be combined with
 gene_expression (the group takes the next unused palette color).

 Lasso: the button under the zoom controls toggles a freehand lasso (an
 OpenLayers Draw interaction). Releasing the pointer selects every cell whose
 centroid lies inside the drawn ring and opens a menu listing the selection:
 per-type counts, then a table of cell ids and their annotated types. Only
 one lasso is kept; drawing again replaces it, toggling off clears it.
 The menu's 'Neighborhood enrichment' button (annotated h5ad only) POSTs the
 selected ids to wsitiles/nhood, which runs the squidpy-style analysis (kNN
 graph over centroids, type-to-neighbour edge counts, permutation z-scores)
 and draws the z-score matrix as a heatmap in a panel under the map.

 Bypasses datasets/samples: hits the wsitiles route with a direct slide path
 (resolved relative to serverconfig.tpmasterdir; gated by features.wsi.allowDirectSlidePath). Minimal
 pan/zoom viewer — the same OpenLayers Zoomify setup the full viewer uses.
*/
import 'ol/ol.css' // OpenLayers base styles
import Map from 'ol/Map.js' // the pan/zoom map widget
import View from 'ol/View.js' // its camera (resolutions + extent)
import TileLayer from 'ol/layer/Tile.js' // mosaics the slide tiles
import Zoomify from 'ol/source/Zoomify.js' // tile source matching wsi_tile.py's tier math
import VectorLayer from 'ol/layer/Vector.js' // boundary strokes / expression fills
import VectorSource from 'ol/source/Vector.js' // holds the polygon features
import Feature from 'ol/Feature.js' // one drawable geometry + style
import MultiPolygon from 'ol/geom/MultiPolygon.js' // many cell rings in one feature
import { Fill, Stroke, Style } from 'ol/style.js' // polygon styling primitives
import RBush from 'ol/structs/RBush.js' // spatial index for the hover hit test
import Draw from 'ol/interaction/Draw.js' // freehand polygon drawing = the lasso
import Control from 'ol/control/Control.js' // hosts the lasso toggle inside the map's viewport
import { select } from 'd3-selection' // wraps the control element for the icon helper
import { scaleLinear } from 'd3-scale' // diverging z-score color scale of the enrichment heatmap
import { dofetch3 } from '#common/dofetch' // fetch wrapper for meta/genecounts
import { sayerror, Menu, renderTable, icons, ColorScale } from '#dom' // error banner, lasso menu + table, lasso icon, heatmap legend

/** Build the viewer in `holder`; opts mirror the URL params documented above */
export async function init(
	opts: {
		/** direct slide path relative to tpmasterdir (runpp ?image_file=) */
		slide?: string
		/** alternative to slide: raw wsitiles query addressing the slide through a
		 dataset (wsimage=&dslabel=&genome=&sample_id=), already URI-encoded —
		 lets the w2 plot reuse this viewer for spatial images without the
		 allowDirectSlidePath gate */
		slideQuery?: string
		/** display name when slide is not given (e.g. the spatial image fileName) */
		label?: string
		/** = spatial_data: the consolidated spatial .h5ad, tpmasterdir-relative —
		 the single source of cell/nucleus boundaries, cell-type annotations and
		 gene expression (the server derives each piece from it) */
		spatialData?: string
		/** fetch the cell polygons (type/expression fills need them) but don't
		 draw their strokes */
		hideCellStrokes?: boolean
		/** skip the nucleus boundary overlay entirely */
		hideNucleusStrokes?: boolean
		/** fill each cell by its annotated cell_type (when present), one
		 categorical color per type, with a legend */
		showCellTypes?: boolean
		/** cell types to fill, as a list (type names are free text and may
		 contain commas); empty/undefined = all types. Colors are assigned over
		 ALL types by abundance, so a type keeps its color when the filter
		 changes */
		cellTypeFilter?: string[]
		/** = annotation_level: strokes only in the n most zoomed-in levels */
		annotationLevel?: string | number
		/** = gene_expression: comma-separated genes, one fill overlay per gene */
		geneExpression?: string
		/** = gene_groups: genes summed into ONE fill overlay */
		geneGroups?: string
		/** fetch the gene counts (hover tooltip reports them) but draw no
		 expression fills/legend — the mass burger's unchecked 'Gene expression' */
		hideExpressionFills?: boolean
		/** map div size; defaults fit the full-window direct viewer */
		width?: string
		height?: string
	},
	/** d3 selection the viewer renders into */
	holder: any
) {
	const name = opts.slide ?? opts.label ?? 'slide' // display name in messages
	const loading = holder.append('div').style('margin', '20px').text(`Loading ${name} …`) // placeholder while meta loads
	try {
		// every wsitiles request carries this query to address the slide
		const sq = opts.slideQuery ?? `slide=${encodeURIComponent(opts.slide!)}`
		const meta = await dofetch3(`wsitiles/meta?${sq}`) // geometry first: tiles need it
		if (!meta || meta.error || meta.status === 'error') throw meta?.error || 'failed to load slide metadata'

		const [w, h] = meta.slide_dimensions // level-0 slide size in px
		// server origin for tile URLs ('' when same-origin); trailing slashes trimmed
		const host = (sessionStorage.getItem('hostURL') || (window as any).testHost || '').replace(/\/+$/, '')

		// z-planes of a 3D OME-TIFF stack (meta.planes = 1 for 2D slides);
		// start on the middle plane, matching the server's default
		const planes: number = meta.planes || 1 // how many z-planes the stack has
		let plane = Math.floor(planes / 2) // the plane currently shown

		const makeSource = (
			p: number // one tile source per z-plane; swapped by the slider
		) =>
			new Zoomify({
				// {z}/{x}/{y} hit wsitiles/tile; unused {TileGroup} satisfies OL's
				// requirement that a {TileGroup}/{tileIndex} placeholder be present.
				// v=<slide mtime>: regenerating the slide file in place busts the
				// browser's immutable tile cache (the server's disk cache keys on it too)
				url: `${host}/wsitiles/tile/{z}/{x}/{y}?${sq}${planes > 1 ? `&plane=${p}` : ''}&v=${
					meta.version || 0
				}&_={TileGroup}`,
				size: [w, h], // OL derives the tier count from this, same math as wsi_tile.py
				crossOrigin: 'anonymous', // tiles come from the API origin, not the page's
				zDirection: -1 // pick the sharper tier when between two zoom levels
			})
		const source = makeSource(plane) // start on the default (middle) plane
		const grid = source.getTileGrid()! // the z/x/y grid OL computed from [w, h]
		const extent = grid.getExtent() // slide bounds in map coordinates

		loading.remove() // meta arrived; the map replaces the placeholder

		const slideLayer = new TileLayer({ source }) // bottom layer: the slide tiles

		// z-plane scroll bar ABOVE the map (the 90vh map pushes anything after
		// it below the fold); swapping the tile source refetches visible tiles
		// for the chosen plane, view position unchanged
		if (planes > 1) {
			const bar = holder.append('div').style('font', '12px system-ui').style('padding', '4px 8px') // the bar itself
			bar.append('span').text('z-plane: ') // static label
			const label = () => `${plane + 1}/${planes}` // 1-based display, e.g. '3/5'
			const planeText = bar.append('span').text(label()) // live readout next to the slider
			bar
				.append('input')
				.attr('type', 'range') // native slider, one notch per plane
				.attr('min', 0) // first plane
				.attr('max', planes - 1) // last plane
				.attr('step', 1) // whole planes only
				.property('value', plane) // start at the default (middle) plane
				.style('vertical-align', 'middle')
				.style('margin-left', '8px')
				.style('width', '200px')
				.on('change', function (this: HTMLInputElement) {
					plane = Number(this.value) // slider position = plane index
					planeText.text(label()) // update the '3/5' readout
					slideLayer.setSource(makeSource(plane)) // refetch visible tiles for this plane
				})
		}

		const mapDiv = holder // the map's container; legends/tooltip position against it
			.append('div')
			.style('width', opts.width ?? '100vw') // full-window unless the w2 plot passes a size
			.style('height', opts.height ?? '90vh')
		const map = new Map({
			target: mapDiv.node(), // mount the map into the holder
			layers: [slideLayer], // overlays are addLayer'd on top below
			view: new View({ resolutions: grid.getResolutions(), extent }) // camera locked to the pyramid
		})
		map.getView().fit(extent) // start fully zoomed out, whole slide visible

		// info line under the map: name, pixel size, µm/px, level count
		holder
			.append('div')
			.style('font', '12px system-ui')
			.style('padding', '4px 8px')
			.text(
				`${name} — ${w}×${h}px${
					Array.isArray(meta.mpp) && meta.mpp.length === 2
						? `, ${meta.mpp[0].toFixed(3)}×${meta.mpp[1].toFixed(3)} µm/px`
						: ''
				}, ${meta.levels} levels`
			)
		const resultsDiv = holder.append('div') // analysis panels under the map (lasso enrichment)

		// Legends are position:fixed and placed from the map's live viewport
		// rectangle, so they are confined to the map's on-screen area no matter
		// what surrounds the viewer: they can never overlap UI outside the map.
		// Scrolling past the map's top pins them near the viewport top while any
		// of the map is visible — but sticky chrome (the mass header/tabs) may
		// float exactly there, over the map, so each pin position is probed with
		// elementFromPoint and slid down until the point actually hits the map
		// (i.e. nothing else covers it). When no uncovered spot remains, the
		// legend hides. Capture-phase scroll listener also catches scrolling
		// ancestors, not just the window.
		const pinned: Array<{ box: any; side: 'left' | 'right' }> = [] // legends + which map corner they hug
		const repin = () => {
			const node = mapDiv.node() // the map the legends are placed against
			if (!node.isConnected) {
				// viewer re-rendered: this render's listeners are dead weight
				window.removeEventListener('scroll', repin, true)
				window.removeEventListener('resize', repin)
				return
			}
			const r = node.getBoundingClientRect() // where the map sits in the viewport
			for (const p of pinned) {
				const el = p.box.node() // the legend's DOM node, for its size
				const left = p.side == 'left' ? r.left + 40 : r.right - el.offsetWidth - 8 // 40: clear of OL zoom buttons
				const maxTop = r.bottom - el.offsetHeight - 8 // never poke out of the map's bottom
				let top = Math.max(r.top + 8, 8) // inside the map; viewport top once scrolled past
				// probe downward past anything covering the map at the pin spot
				// (visibility:hidden keeps the legend itself out of the probe)
				p.box.style('visibility', 'hidden')
				while (top <= maxTop) {
					const hit = document.elementFromPoint(left + 1, top) // topmost element at the corner
					if (hit && node.contains(hit)) break // the map itself: spot is uncovered
					top += 24 // slide below the covering chrome and retry
				}
				if (top > maxTop) continue // no uncovered spot big enough: stay hidden
				p.box.style('visibility', 'visible').style('top', `${top}px`).style('left', `${left}px`)
			}
		}
		window.addEventListener('scroll', repin, { capture: true, passive: true })
		window.addEventListener('resize', repin) // map rectangle moves on resize too

		// segmentation overlays: boundary CSVs are in µm, converted to level-0
		// pixels via the slide's mpp (defaulting to 1 = coords already in px)
		const [mppX, mppY] = Array.isArray(meta.mpp) && meta.mpp.length === 2 ? meta.mpp : [1, 1]

		// annotation_level=n: show the overlays only within the n most zoomed-in
		// levels. OL picks the tile level with resolution <= the view resolution,
		// so "within the n finest levels" means view resolution < the (n+1)'th
		// finest grid resolution — that becomes the layer's (exclusive) maxResolution.
		const resolutions = grid.getResolutions() // per-tier map resolutions, coarse -> fine
		const n = Number(opts.annotationLevel) // boundaries visible in the n finest tiers
		const maxResolution =
			Number.isInteger(n) && n > 0 && n < resolutions.length ? resolutions[resolutions.length - 1 - n] : undefined

		// the two boundary overlays: file, kind (h5ad piece selector — with a
		// consolidated store both files are the SAME h5ad, so kind, not the
		// file name, identifies the overlay), and stroke color (cell green,
		// nucleus blue)
		const geneList = (
			s?: string // comma-separated param -> clean gene name list
		) =>
			(s || '')
				.split(',')
				.map(t => t.trim())
				.filter(Boolean)
		const exprGenes = geneList(opts.geneExpression) // one overlay per gene
		const groupGenes = geneList(opts.geneGroups) // summed into a single overlay

		// which overlays need the h5ad: cell polygons serve the strokes, the
		// type/expression fills and the hover tooltip; nucleus polygons only
		// their own strokes
		const needCellPolys =
			!!opts.spatialData &&
			(!opts.hideCellStrokes || opts.showCellTypes || exprGenes.length > 0 || groupGenes.length > 0)
		const overlays: Array<['cell' | 'nucleus', boolean, string]> = [
			['cell', needCellPolys, 'rgba(0, 200, 80, 0.9)'],
			['nucleus', !!opts.spatialData && !opts.hideNucleusStrokes, 'rgba(0, 150, 255, 0.9)']
		]
		let cellPolys: CellPoly[] | undefined // kept for the expression/type fills below
		for (const [kind, wanted, color] of overlays) {
			if (!wanted) continue // that overlay was not requested
			try {
				const polys = await fetchBoundaries(host, sq, opts.spatialData!, kind, mppX, mppY) // h5ad -> px polygons
				if (kind == 'cell') {
					cellPolys = polys // expression/type fills reuse these rings
					if (opts.hideCellStrokes) continue // polygons fetched, strokes suppressed
				}
				map.addLayer(strokeLayer(polys, color, maxResolution)) // draw on top of the slide
			} catch (e: any) {
				sayerror(holder, `Error loading ${kind} boundaries: ${e.message || e}`) // one overlay failing kills nothing else
			}
		}

		// per-cell annotations from the h5ad, as JSON {cells:{cell_id:type}} —
		// cell types are free text, so they never travel as CSV; feeds the
		// type fills + tooltip. Useless without the cell polygons.
		let cellTypes: { [id: string]: string } | undefined // cell_id -> annotated type
		if (opts.spatialData && cellPolys) {
			try {
				const r = await dofetch3(`wsitiles/annotations?${sq}&file=${encodeURIComponent(opts.spatialData)}`)
				if (!r || r.error) throw new Error(r?.error || 'failed to load annotations')
				cellTypes = r.cells // the id->type map, served ready to use
			} catch (e: any) {
				sayerror(holder, `Error loading annotations: ${e.message || e}`) // overlay lost, viewer lives
			}
		}

		// cell-type overlay: fill each annotated cell in its type's categorical
		// color, with its own legend (top-left; the gene legend uses top-right).
		// No-op when the h5ad held no cell types.
		// While it is shown, the gene expression FILLS are suppressed below (the
		// two fills are unreadable on top of each other) — gene counts are still
		// fetched so hovering a cell reports its expression.
		const typesShown = !!(opts.showCellTypes && cellPolys && cellTypes && Object.keys(cellTypes).length)
		if (typesShown && cellPolys && cellTypes) {
			// types ordered by abundance so colors go to the biggest populations first
			const counts: { [t: string]: number } = Object.create(null) // cells per type, for ordering + legend
			for (const id in cellTypes) counts[cellTypes[id]] = (counts[cellTypes[id]] || 0) + 1 // tally
			const types = Object.keys(counts).sort((a, b) => counts[b] - counts[a]) // most abundant first
			const typeColor: { [t: string]: string } = Object.create(null) // type -> its stable palette color
			for (const [i, t] of types.entries()) typeColor[t] = CELL_TYPE_COLORS[i % CELL_TYPE_COLORS.length]
			// optional filter: fill + legend only these types (colors unchanged)
			const wanted = opts.cellTypeFilter || [] // the requested type list
			const shown = wanted.length ? types.filter(t => wanted.includes(t)) : types // empty filter = all
			const shownColor: { [t: string]: string } = Object.create(null) // color subset acting as the fill filter
			for (const t of shown) shownColor[t] = typeColor[t] // only shown types get a fill
			map.addLayer(cellTypeLayer(cellPolys, cellTypes, shownColor)) // draw the type fills

			// the type legend box, over the map's top-left; repin() places it
			const legend = mapDiv
				.append('div')
				.attr('data-testid', 'sjpp-wsi-typelegend') // stable hook for tests
				.style('position', 'fixed') // viewport-placed by repin(), confined to the map's rectangle
				.style('z-index', '10')
				.style('background', 'rgba(255,255,255,0.85)')
				.style('padding', '6px 10px')
				.style('border-radius', '4px')
				.style('font', '12px system-ui')
				.style('max-height', '50vh')
				.style('overflow-y', 'auto')
			legend.append('div').style('font-weight', 'bold').style('margin-bottom', '2px').text('Cell type') // title
			for (const t of shown) {
				const row = legend.append('div').style('margin', '2px 0') // one legend row per type
				row // the type's color swatch
					.append('span')
					.style('display', 'inline-block')
					.style('width', '10px')
					.style('height', '10px')
					.style('margin-right', '6px')
					.style('border', '1px solid #ccc')
					.style('background', `rgb(${typeColor[t]})`)
				row.append('span').text(`${t} (${counts[t]})`) // type name + its cell count
			}
			pinned.push({ box: legend, side: 'left' }) // top-left corner, clear of the zoom buttons
			repin() // place it now; scrolling keeps it placed
		}

		// per-gene count maps kept for the hover tooltip below
		const geneCounts: { gene: string; cells: { [id: string]: number } }[] = []

		if (exprGenes.length || groupGenes.length) {
			try {
				if (!opts.spatialData)
					// counts live in the h5ad; genes without it can't render
					throw new Error('gene_expression/gene_groups requires spatial_data=<h5ad file>')
				if (!cellPolys) throw new Error('gene_expression/gene_groups needs the cell polygons') // nothing to fill
				// one genecounts request per gene, expr + group genes together
				const results = await Promise.all(
					[...exprGenes, ...groupGenes].map(gene =>
						dofetch3(
							`wsitiles/genecounts?${sq}&file=${encodeURIComponent(opts.spatialData!)}&gene=${encodeURIComponent(gene)}`
						).catch((e: any) => ({ error: e.message || String(e) }))
					)
				)
				// legend overlaid on the map's top-right corner — anything appended
				// below the 90vh map div lands below the fold and is never seen.
				// Created lazily so an all-errors run doesn't leave an empty box.
				let legend: any
				const addLegend = (rgb: string, name: string, max: number) => {
					if (!legend) {
						legend = mapDiv // the gene legend box, over the map's top-right; repin() places it
							.append('div')
							.style('position', 'fixed') // viewport-placed by repin(), confined to the map's rectangle
							.style('z-index', '10')
							.style('background', 'rgba(255,255,255,0.85)')
							.style('padding', '6px 10px')
							.style('border-radius', '4px')
							.style('font', '12px system-ui')
						pinned.push({ box: legend, side: 'right' }) // hug the map's top-right corner
					}
					const row = legend.append('div').style('margin', '2px 0') // one legend row per gene
					row.append('span').style('margin-right', '6px').text(name) // the gene's name
					// alpha range mirrors expressionLayer's shades (log-scaled counts)
					row
						.append('span')
						.style('display', 'inline-block')
						.style('width', '80px')
						.style('height', '10px')
						.style('vertical-align', 'middle')
						.style('border', '1px solid #ccc')
						.style('background', `linear-gradient(to right, rgba(${rgb}, 0.15), rgba(${rgb}, 0.9))`)
					row.append('span').style('margin-left', '4px').text(`1–${max}`) // the count range the gradient spans
					repin() // re-place: each added row changes the legend's size
				}

				// gene_expression: one layer per gene, each its own color
				let colorIdx = 0 // next palette slot; shared with the group overlay
				for (const [i, gene] of exprGenes.entries()) {
					const r = results[i] // this gene's genecounts answer
					if (!r || r.error) {
						sayerror(holder, `Gene expression error (${gene}): ${r?.error || 'failed to load'}`) // surface it
						continue // one bad gene doesn't block the others
					}
					geneCounts.push({ gene, cells: r.cells }) // tooltip shows this gene's per-cell count
					// cell-type fills win / fills unchecked; counts stay hover-only
					if (typesShown || opts.hideExpressionFills) continue
					const rgb = GENE_COLORS[colorIdx++ % GENE_COLORS.length] // this gene's fill color
					map.addLayer(expressionLayer(cellPolys, r.cells, r.max, rgb)) // fill the expressing cells
					addLegend(rgb, gene, r.max) // gradient + count range in the legend
				}

				// gene_groups: sum each cell's counts over the group, one layer/color
				if (groupGenes.length) {
					const total: { [id: string]: number } = {} // per-cell sum across the group
					const found: string[] = [] // genes that actually answered
					for (const [i, gene] of groupGenes.entries()) {
						const r = results[exprGenes.length + i] // group answers follow the expr ones
						if (!r || r.error) {
							sayerror(holder, `Gene expression error (${gene}): ${r?.error || 'failed to load'}`) // surface it
							continue // skip the missing gene, keep summing the rest
						}
						found.push(gene) // this gene contributes to the sum
						for (const id in r.cells) total[id] = (total[id] || 0) + r.cells[id] // accumulate per cell
					}
					if (found.length) {
						geneCounts.push({ gene: found.join('+'), cells: total }) // summed count in the tooltip
						if (!typesShown && !opts.hideExpressionFills) {
							// fills allowed (no cell-type overlay, checkbox on): draw the sum
							let max = 0 // the summed overlay's own count ceiling
							for (const id in total) if (total[id] > max) max = total[id] // find it
							const rgb = GENE_COLORS[colorIdx++ % GENE_COLORS.length] // next unused palette color
							map.addLayer(expressionLayer(cellPolys, total, max, rgb)) // ONE overlay of the totals
							addLegend(rgb, found.join('+'), max) // e.g. 'PTPRC+EPCAM'
						}
					}
				}
			} catch (e: any) {
				sayerror(holder, `Gene expression error: ${e.message || e}`) // config errors from the throws above
			}
		}

		// hover tooltip: cell id, annotated type, per-gene counts. Active only
		// while the boundary strokes are visible, i.e. zoomed within
		// annotation_level (always, when that param is not set).
		if (cellPolys) {
			// spatial index over the cell bounding boxes, built once: each
			// pointermove queries only the handful of cells whose bbox contains
			// the pointer instead of scanning all ~100k (OL's bundled rbush)
			const index = new RBush<CellPoly>()
			for (const c of cellPolys) {
				let minX = Infinity, // the ring's bounding box
					minY = Infinity,
					maxX = -Infinity,
					maxY = -Infinity
				for (const [vx, vy] of c.ring) {
					if (vx < minX) minX = vx
					if (vx > maxX) maxX = vx
					if (vy < minY) minY = vy
					if (vy > maxY) maxY = vy
				}
				index.insert([minX, minY, maxX, maxY], c) // bbox -> its cell
			}
			// the tooltip box, following the cursor; fixed and placed from the
			// map's viewport rectangle, immune to the surrounding page's layout
			const tip = mapDiv
				.append('div')
				.attr('data-testid', 'sjpp-wsi-tooltip') // stable hook for e2e tests
				.style('position', 'fixed')
				.style('display', 'none')
				.style('z-index', '20')
				.style('pointer-events', 'none') // never steal the pointer from the map
				.style('background', 'rgba(255,255,255,0.9)')
				.style('padding', '4px 8px')
				.style('border-radius', '4px')
				.style('font', '12px system-ui')
				.style('white-space', 'pre') // one datum per line via \n
			// zooming without moving the mouse fires no pointermove, which would
			// leave a stale tooltip up (e.g. wheel-zooming out past
			// annotation_level); hide on every zoom change — the next pointermove
			// re-shows it when a cell is under the cursor and the zoom allows
			map.getView().on('change:resolution', () => tip.style('display', 'none'))
			map.on('pointermove', (evt: any) => {
				const res = map.getView().getResolution() // current zoom, in map units/px
				if (evt.dragging || (maxResolution !== undefined && !(typeof res == 'number' && res < maxResolution))) {
					tip.style('display', 'none') // panning, or zoomed out past annotation_level
					return
				}
				const [x, y] = evt.coordinate // pointer position in map (level-0 px) coords
				let hit: CellPoly | undefined // the cell under the pointer, if any
				for (const c of index.getInExtent([x, y, x, y])) {
					// only cells whose bbox contains the pointer reach the ray cast
					if (pointInRing(x, y, c.ring)) {
						hit = c // exact polygon hit
						break // first match wins
					}
				}
				if (!hit) {
					tip.style('display', 'none') // pointer over no cell
					return
				}
				const rows = tooltipRows(hit.id, cellTypes, geneCounts) // the tooltip's lines
				const mr = mapDiv.node().getBoundingClientRect() // map rect: OL pixel -> viewport coords
				tip // place the box just below-right of the cursor and fill it
					.style('display', 'block')
					.style('left', `${mr.left + evt.pixel[0] + 12}px`)
					.style('top', `${mr.top + evt.pixel[1] + 12}px`)
					.text(rows.join('\n'))
			})

			// lasso: freehand polygon drawn on its own vector layer; on release,
			// the cells whose centroid falls inside it are listed in a menu.
			// Reuses the hover index: only cells whose bbox meets the lasso's
			// extent are ray-cast. Not gated by annotation_level — a region can
			// be selected at any zoom.
			const lassoSource = new VectorSource() // holds the one drawn ring
			map.addLayer(
				new VectorLayer({
					source: lassoSource,
					style: new Style({
						stroke: new Stroke({ color: 'rgba(255, 140, 0, 0.9)', width: 2 }), // orange outline
						fill: new Fill({ color: 'rgba(255, 140, 0, 0.1)' }) // faint tint of the region
					})
				})
			)
			const draw = new Draw({ source: lassoSource, type: 'Polygon', freehand: true }) // the lasso itself
			const lassoMenu = new Menu({ padding: '8px', testid: 'sjpp-wsi-lasso-menu' }) // the selection popup
			let lassoOn = false // whether the Draw interaction is on the map
			// the toggle lives in an OL control so it sits inside the map's
			// viewport with the zoom buttons (just below them)
			const ctl = document.createElement('div') // the control's element
			ctl.className = 'ol-unselectable ol-control' // OL styles it as a control
			// inline, not left to .ol-control: a global rule wins on this element and
			// makes it position:relative, i.e. a full-width block whose grey control
			// background paints a band across the map
			ctl.style.position = 'absolute'
			ctl.style.top = '65px' // right under the +/- zoom buttons
			ctl.style.left = '.5em' // aligned with them
			map.addControl(new Control({ element: ctl }))
			const btn = icons.lasso(select(ctl).attr('data-testid', 'sjpp-wsi-lasso-btn'), {
				title: 'Lasso: drag to select cells',
				enabled: false, // starts off; the handler repaints the button
				handler: () => {
					lassoOn = !lassoOn
					btn.select('button').style('background-color', lassoOn ? 'rgb(207, 226, 243)' : 'transparent') // on = tinted
					if (lassoOn) map.addInteraction(draw) // drags now draw instead of panning
					else {
						map.removeInteraction(draw) // back to pan/zoom
						lassoSource.clear() // drop the drawn region
						lassoMenu.hide()
					}
				}
			})
			draw.on('drawstart', () => {
				lassoSource.clear() // one lasso at a time
				lassoMenu.hide()
			})
			draw.on('drawend', (evt: any) => {
				const geom = evt.feature.getGeometry() // the finished polygon
				const ring: number[][] = geom.getCoordinates()[0] // its outer ring, map coords
				const hits = cellsInLasso(ring, index.getInExtent(geom.getExtent())) // bbox prefilter, then ray cast
				const px = map.getPixelFromCoordinate(ring[ring.length - 1]) // where the pointer was released
				const mr = mapDiv.node().getBoundingClientRect() // map rect: OL pixel -> viewport coords
				showLassoMenu(lassoMenu, hits, cellTypes, mr.left + px[0], mr.top + px[1], runNhood)
			})

			// neighborhood enrichment of the lasso selection: the server reads the
			// selected cells' centroids and types from the h5ad, so only ids travel.
			// Rendered into a panel under the map (replacing the previous run) so
			// the result outlives the menu. Absent without annotations: the
			// analysis is over cell types.
			const runNhood =
				opts.spatialData && cellTypes
					? async (ids: string[], k = 6, perms = 1000) => {
							lassoMenu.hide()
							resultsDiv.selectAll('*').remove() // one panel at a time
							const panel = resultsDiv
								.append('div')
								.attr('data-testid', 'sjpp-wsi-nhood')
								.style('margin', '8px')
								.style('font', '12px system-ui')
							panel
								.append('div')
								.text(`Neighborhood enrichment: running on ${ids.length} cells, k=${k}, ${perms} permutations …`) // permutations take a moment
							try {
								const r = await dofetch3(`wsitiles/nhood?${sq}`, {
									method: 'POST', // explicit: dofetch3's GET path would URL-encode the id list (and re-encode it as strings past the URL length limit)
									body: { file: opts.spatialData, ids, k, perms }
								})
								if (!r || r.error) throw new Error(r?.error || 'failed to compute neighborhood enrichment')
								panel.selectAll('*').remove()
								// the panel's k/permutation controls rerun on the SAME selection
								renderNhoodHeatmap(panel, r, (k2, p2) => runNhood!(ids, k2, p2))
							} catch (e: any) {
								panel.selectAll('*').remove()
								sayerror(panel, `Neighborhood enrichment error: ${e.message || e}`) // the lasso and viewer live on
							}
					  }
					: undefined
		}
	} catch (e: any) {
		loading.remove() // drop the placeholder before showing the error
		sayerror(holder, `WSI error: ${e.message || e}`) // anything fatal: meta failure, bad slide path
	}
}

/** one cell's polygon: unquoted cell_id + closed vertex ring in map coords */
type CellPoly = { id: string; ring: number[][] }

/** The hover tooltip's lines for one cell: its id, its annotated type (line
 omitted when the cell is unannotated), and one count per loaded gene overlay
 (0.0 when the cell doesn't express it). (exported for tests) */
export function tooltipRows(
	/** the hovered cell's id */
	id: string,
	/** cell_id -> annotated type, when annotations loaded */
	cellTypes: { [id: string]: string } | undefined,
	/** one entry per loaded gene overlay, with its per-cell counts */
	geneCounts: { gene: string; cells: { [id: string]: number } }[]
): string[] {
	const rows = [`cell id: ${id}`] // line 1: the cell's id
	const t = cellTypes?.[id] // its annotated type, if any
	if (t) rows.push(`cell type: ${t}`) // line 2: the type
	for (const g of geneCounts) rows.push(`${g.gene} expression: ${(g.cells[id] || 0).toFixed(1)}`) // per gene
	return rows
}

/** even-odd ray cast: is (x, y) inside the closed ring? (exported for tests) */
export function pointInRing(x: number, y: number, ring: number[][]): boolean {
	let inside = false // parity of edge crossings so far
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const [xi, yi] = ring[i] // edge endpoint i
		const [xj, yj] = ring[j] // edge endpoint j (previous vertex)
		// edge spans y; flip parity when the ray to the left crosses it
		if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
	}
	return inside // odd crossings = inside
}

/** The cells whose centroid (vertex mean) lies inside the lasso ring; order
 preserved from `cells` (exported for tests). Centroid-in-ring, not polygon
 overlap: a cell counts when most of it is inside, which is what a hand-drawn
 region means, and it keeps the test to one ray cast per candidate. */
export function cellsInLasso(
	/** the lasso's outer ring, map coords */
	ring: number[][],
	/** candidate cells (typically the bbox-index hits for the ring's extent) */
	cells: Iterable<CellPoly>
): CellPoly[] {
	const hits: CellPoly[] = [] // selected cells
	for (const c of cells) {
		let sx = 0, // running vertex sums
			sy = 0
		for (const [x, y] of c.ring) {
			sx += x
			sy += y
		}
		if (pointInRing(sx / c.ring.length, sy / c.ring.length, ring)) hits.push(c) // centroid inside = selected
	}
	return hits
}

/** Fill and show the lasso menu at viewport (x, y): a per-type count summary
 (types by descending count, unannotated cells last), then a table of every
 selected cell's id and type. An empty selection shows a one-line notice. */
function showLassoMenu(
	menu: Menu,
	hits: CellPoly[],
	cellTypes: { [id: string]: string } | undefined,
	x: number,
	y: number,
	/** runs the neighborhood enrichment on the selected ids; absent = no button */
	runNhood?: (ids: string[]) => Promise<void>
) {
	menu.clear().show(x, y)
	const d = menu.d.append('div').style('font', '12px system-ui')
	if (!hits.length) {
		d.text('No cells in the lasso') // nothing to list
		return
	}
	d.append('div').style('font-weight', 'bold').text(`${hits.length} cells selected`) // headline count
	if (runNhood) {
		// mirrors the route's ids*k*perms cap (server/src/routes/wsitiles.ts) at the
		// default k=6/perms=1000 the button runs with, so an oversized lasso gets an
		// instant explanation instead of a POST the server would reject anyway
		const maxCells = Math.floor(50_000_000 / (6 * 1000))
		if (hits.length > maxCells)
			d.append('div')
				.style('margin', '4px 0')
				.style('color', '#a00')
				.text(`Selection too large for neighborhood enrichment (max ${maxCells} cells) — draw a smaller lasso`)
		else
			d.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.attr('data-testid', 'sjpp-wsi-nhood-btn')
				.style('margin', '4px 0')
				.text('Neighborhood enrichment')
				.on('click', () => runNhood(hits.map(c => c.id)))
	}
	if (cellTypes) {
		// per-type tally of the selection, the input the enrichment step will consume
		const counts: { [t: string]: number } = Object.create(null)
		for (const c of hits) {
			const t = cellTypes[c.id] || 'unannotated' // cells the h5ad left unannotated get their own bucket
			counts[t] = (counts[t] || 0) + 1
		}
		const types = Object.keys(counts).sort((a, b) =>
			a == 'unannotated' ? 1 : b == 'unannotated' ? -1 : counts[b] - counts[a]
		)
		const sum = d.append('div').attr('data-testid', 'sjpp-wsi-lasso-summary').style('margin', '4px 0 6px 0') // the tally
		for (const t of types) sum.append('div').text(`${t}: ${counts[t]}`) // one line per type
	}
	const columns = [{ label: 'Cell ID' }] as { label: string }[] // id always; type only when annotated
	if (cellTypes) columns.push({ label: 'Cell type' })
	renderTable({
		columns,
		rows: hits.map(c => (cellTypes ? [{ value: c.id }, { value: cellTypes[c.id] || '' }] : [{ value: c.id }])), // one row per cell
		div: d.append('div').attr('data-testid', 'sjpp-wsi-lasso-table'),
		showLines: true,
		maxHeight: '40vh'
	})
}

/** Fetch one polygon set of the h5ad (via wsitiles/boundaries) and parse it
 into one closed ring per cell, keyed by the unquoted cell_id. */
async function fetchBoundaries(
	/** server origin ('' when same-origin) */
	host: string,
	/** wsitiles query addressing the slide (slide= or dataset params) */
	sq: string,
	/** the consolidated .h5ad the server regenerates the CSV from */
	file: string,
	/** which polygon set */
	kind: 'cell' | 'nucleus',
	/** µm per pixel, x and y, from meta.mpp */
	mppX: number,
	mppY: number
): Promise<CellPoly[]> {
	const res = await fetch(`${host}/wsitiles/boundaries?${sq}&file=${encodeURIComponent(file)}&kind=${kind}`) // raw csv text
	if (!res.ok) throw new Error(`${res.status} ${res.statusText}`) // http failure = overlay error banner
	return parseBoundaries(await res.text(), mppX, mppY) // csv -> polygons
}

/** Parse a boundary CSV into one closed ring per cell (exported for tests). */
export function parseBoundaries(
	/** the CSV's full text */
	text: string,
	/** µm per pixel, x and y; 1 = coords already in px */
	mppX: number,
	mppY: number
): CellPoly[] {
	// rows: "cell_id",vertex_x,vertex_y — one cell's vertices are contiguous.
	// Splitting on commas is safe here BECAUSE of what the columns hold: a
	// Xenium cell id and two numbers, never quoted free text (cell types,
	// which are free text, travel as JSON via wsitiles/annotations instead).
	// OL's Zoomify extent is [0,-h,w,0]: x in px to the right, y in px negated.
	const lines = text.split('\n') // one vertex row per line
	const cells: CellPoly[] = [] // finished polygons
	let ring: number[][] = [] // vertices of the cell being read
	let curId = '' // the cell those vertices belong to
	for (const line of lines) {
		const [id, xs, ys] = line.split(',') // cell id + µm coordinates
		const x = Number(xs) // numeric x doubles as the row-validity check
		if (!xs || Number.isNaN(x)) continue // header / blank line
		if (id !== curId) {
			// a new cell_id starts: close out the previous cell's ring
			if (ring.length > 2) cells.push({ id: curId.replace(/"/g, ''), ring })
			ring = [] // start collecting the new cell's vertices
			curId = id // remember whose they are
		}
		ring.push([x / mppX, -Number(ys) / mppY]) // µm -> level-0 px, y negated for OL
	}
	if (ring.length > 2) cells.push({ id: curId.replace(/"/g, ''), ring }) // don't drop the last cell
	return cells
}

/** One stroke-only vector layer holding every polygon; maxResolution (when
 set) hides the layer once the user zooms out beyond it.
 ponytail: all ~100k polygons in one MultiPolygon feature — switch to vector
 tiling if rendering within the visible zoom range ever feels sluggish. */
function strokeLayer(cells: CellPoly[], color: string, maxResolution?: number): VectorLayer {
	return new VectorLayer({
		// every ring wrapped into a single MultiPolygon feature
		source: new VectorSource({ features: [new Feature(new MultiPolygon(cells.map(c => [c.ring])))] }),
		style: new Style({ stroke: new Stroke({ color, width: 1 }) }), // outline only, no fill
		maxResolution // undefined = visible at every zoom
	})
}

// number of opacity steps for the expression fills
const SHADES = 8

// fill colors ("r, g, b") cycled per gene; green/blue-ish avoided so fills
// stay distinguishable from the cell (green) and nucleus (blue) strokes
const GENE_COLORS = ['255, 0, 0', '0, 90, 255', '255, 165, 0', '160, 0, 200', '0, 160, 160', '200, 160, 0']

// categorical palette ("r, g, b") for the cell-type overlay, most-abundant
// type first; ~tableau20 order, cycled if a sample has more types
const CELL_TYPE_COLORS = [
	'31, 119, 180',
	'255, 127, 14',
	'44, 160, 44',
	'214, 39, 40',
	'148, 103, 189',
	'140, 86, 75',
	'227, 119, 194',
	'127, 127, 127',
	'188, 189, 34',
	'23, 190, 207',
	'174, 199, 232',
	'255, 187, 120',
	'152, 223, 138',
	'255, 152, 150',
	'197, 176, 213',
	'196, 156, 148',
	'247, 182, 210',
	'199, 199, 199',
	'219, 219, 141',
	'158, 218, 229'
]

/** One fill layer for the cell-type overlay: cells grouped by type, one
 MultiPolygon feature per type in that type's color at a fixed opacity.
 Unannotated (QC-filtered) cells stay unfilled. */
function cellTypeLayer(
	/** every cell polygon of the slide */
	cells: CellPoly[],
	/** cell_id -> annotated type */
	cellTypes: { [id: string]: string },
	/** type -> fill color; a type absent here is not drawn */
	typeColor: { [t: string]: string }
): VectorLayer {
	const byType: { [t: string]: number[][][][] } = {} // polygon lists per type
	for (const c of cells) {
		const t = cellTypes[c.id] // this cell's annotation, if any
		if (t && typeColor[t]) (byType[t] ||= []).push([c.ring]) // typeColor doubles as the filter
	}
	const features: Feature[] = [] // one feature per type
	for (const t in byType) {
		const f = new Feature(new MultiPolygon(byType[t])) // all of this type's cells at once
		f.setStyle(new Style({ fill: new Fill({ color: `rgba(${typeColor[t]}, 0.45)` }) })) // fixed-opacity fill
		features.push(f)
	}
	return new VectorLayer({ source: new VectorSource({ features }) }) // fills only, no strokes
}

/** Fill each expressing cell with `rgb` at an opacity scaling with the cell's
 transcript count for the chosen gene; zero-count cells stay unfilled. Cells
 are bucketed into SHADES opacity steps so the layer is a handful of
 MultiPolygon features instead of one per cell. Counts are log-normalized
 (log1p(n)/log1p(max)) so a few hot cells don't push everything else into
 the faintest shade. Shown at every zoom level — annotation_level only
 gates the boundary strokes, not the expression fills. */
function expressionLayer(cells: CellPoly[], counts: { [id: string]: number }, max: number, rgb: string): VectorLayer {
	const buckets: number[][][][][] = Array.from({ length: SHADES }, () => []) // one polygon list per shade
	for (const c of cells) {
		const n = counts[c.id] // this cell's transcript count
		if (!n || !max) continue // zero count (or empty result): no fill
		// log-normalize the count into a shade index 0..SHADES-1
		buckets[Math.min(SHADES - 1, Math.floor((Math.log1p(n) / Math.log1p(max)) * SHADES))].push([c.ring])
	}
	const features: Feature[] = [] // one MultiPolygon feature per non-empty shade
	for (const [i, polys] of buckets.entries()) {
		if (!polys.length) continue // no cell landed in this shade
		const f = new Feature(new MultiPolygon(polys)) // all of this shade's cells at once
		const alpha = 0.15 + (0.75 * (i + 1)) / SHADES // faintest 0.24 .. strongest 0.90
		f.setStyle(new Style({ fill: new Fill({ color: `rgba(${rgb}, ${alpha.toFixed(2)})` }) })) // the shade's fill
		features.push(f)
	}
	return new VectorLayer({ source: new VectorSource({ features }) }) // fills only, no strokes
}

/** The wsitiles/nhood answer: one row/column per cell type, in `types` order */
export type NhoodResult = {
	types: string[]
	/** count[a][b]: edges from a type-a cell to a type-b neighbour */
	count: number[][]
	/** z-score of count vs. permuted labels; null where the permutations had no variance */
	zscore: (number | null)[][]
	cells: number
	skipped: number
	k: number
	perms: number
}

/** Draw the enrichment z-score matrix as a heatmap into `holder`: diverging
 blue (depleted) – gray (neutral) – red (enriched) around 0, symmetric domain
 ±max|z|, the value printed in each cell, a native tooltip with the edge
 count, a legend bar, and a close button. Types are rows (the cell) and
 columns (its neighbour). (exported for tests) */
export function renderNhoodHeatmap(
	holder: any,
	r: NhoodResult,
	/** rerun the analysis with new k / permutations; absent = no controls */
	rerun?: (k: number, perms: number) => void
) {
	const C = r.types.length // matrix size
	let m = 1 // color domain half-width: the largest finite |z|, at least 1
	for (const row of r.zscore) for (const z of row) if (z != null && Math.abs(z) > m) m = Math.abs(z)
	const color = scaleLinear<string>().domain([-m, 0, m]).range(['#2a78d6', '#f0efec', '#d0342c']) // blue–gray–red
	const cs = 34, // cell size, px
		gap = 2, // surface gap between fills
		labelW = Math.min(180, 14 + 6.5 * Math.max(...r.types.map(t => t.length))), // row label column
		topH = Math.min(140, 14 + 5 * Math.max(...r.types.map(t => t.length))) // rotated column labels

	const head = holder.append('div').style('display', 'flex').style('align-items', 'baseline').style('gap', '10px')
	head
		.append('div')
		.style('font-weight', 'bold')
		.text(
			`Neighborhood enrichment — ${r.cells} cells, ${r.k} nearest neighbours, ${r.perms} permutations` +
				(r.skipped ? `, ${r.skipped} unannotated cells skipped` : '')
		)
	if (rerun) {
		// k and permutation controls, prefilled with the values that ran; bounds
		// mirror the route's clamps. Native number inputs, no widget library.
		const ctl = head.append('span').attr('data-testid', 'sjpp-wsi-nhood-controls').style('opacity', 0.85)
		const numInput = (label: string, value: number, min: number, max: number, title: string) => {
			ctl.append('label').attr('title', title).style('margin-left', '6px').text(`${label} `)
			return ctl
				.append('input')
				.attr('type', 'number')
				.attr('min', min)
				.attr('max', max)
				.attr('step', 1)
				.style('width', '5em')
				.property('value', value)
		}
		const kIn = numInput('k', r.k, 1, 30, 'nearest neighbours per cell')
		const pIn = numInput('permutations', r.perms, 10, 5000, 'random relabellings for the null distribution')
		const clamp = (el: any, lo: number, hi: number) =>
			Math.min(hi, Math.max(lo, Math.round(Number(el.property('value')) || lo)))
		ctl
			.append('button')
			.attr('data-testid', 'sjpp-wsi-nhood-rerun')
			.style('margin-left', '6px')
			.text('Rerun')
			.on('click', () => rerun(clamp(kIn, 1, 30), clamp(pIn, 10, 5000)))
	}
	head
		.append('span')
		.attr('role', 'button')
		.attr('tabindex', 0)
		.style('cursor', 'pointer')
		.style('opacity', 0.6)
		.attr('title', 'Close')
		.text('✕')
		.on('click', () => holder.remove())
	holder
		.append('div')
		.style('opacity', 0.7)
		.style('margin', '2px 0 6px 0')
		.text(
			'z-score of edge counts from each cell type (row) to its neighbours (column) vs. shuffled labels: red = enriched, blue = depleted'
		)

	const svg = holder
		.append('svg')
		.attr('width', labelW + C * (cs + gap) + 10)
		.attr('height', topH + C * (cs + gap) + 10)
		.style('font', '11px system-ui')
	const g = svg.append('g').attr('transform', `translate(${labelW},${topH})`)
	for (const [i, t] of r.types.entries()) {
		// row label (right-aligned at the matrix's left edge) and rotated column label
		g.append('text')
			.attr('x', -6)
			.attr('y', i * (cs + gap) + cs / 2)
			.attr('dy', '0.35em')
			.attr('text-anchor', 'end')
			.attr('fill', '#0b0b0b')
			.text(t)
		g.append('text')
			.attr('transform', `translate(${i * (cs + gap) + cs / 2},-6) rotate(-45)`)
			.attr('text-anchor', 'start')
			.attr('fill', '#0b0b0b')
			.text(t)
	}
	for (const [i, a] of r.types.entries()) {
		for (const [j, b] of r.types.entries()) {
			const z = r.zscore[i][j] // this pair's z-score (null = undefined)
			const cell = g
				.append('g')
				.attr('class', 'sjpp-wsi-nhood-cell')
				.attr('transform', `translate(${j * (cs + gap)},${i * (cs + gap)})`)
			cell
				.append('rect')
				.attr('width', cs)
				.attr('height', cs)
				.attr('rx', 3)
				.attr('fill', z == null ? '#f0efec' : color(z))
			cell
				.append('text')
				.attr('x', cs / 2)
				.attr('y', cs / 2)
				.attr('dy', '0.35em')
				.attr('text-anchor', 'middle')
				.attr('fill', z != null && Math.abs(z) / m > 0.6 ? '#fff' : '#0b0b0b') // readable on the saturated ends
				.text(z == null ? '–' : z.toFixed(1))
			cell.append('title').text(`${a} → ${b}\nz-score: ${z == null ? 'n/a' : z.toFixed(2)}\nedges: ${r.count[i][j]}`) // hover detail
		}
	}
	// legend: the same diverging scale, ticks at nice values of ±m
	const legendSvg = holder.append('svg').attr('width', 220).attr('height', 45).style('font', '11px system-ui')
	new ColorScale({
		holder: legendSvg,
		domain: [-m, 0, m],
		colors: ['#2a78d6', '#f0efec', '#d0342c'],
		width: 180,
		height: 40,
		position: '15,5',
		ticks: 5
	})
}
