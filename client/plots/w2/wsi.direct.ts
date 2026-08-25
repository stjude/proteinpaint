/*
 Direct whole-slide viewer for a single file, launched via runpp URL param:
   http://localhost:3000/?image_file=SVS/slide.svs
 The format (SVS, OME-TIFF, ...) is deduced from the file extension,
 case-insensitively, by the server (wsi_tile.py open_slide()).

 Optional boundary overlays (Xenium segmentation), drawn when these params name
 CSV files; like the slide itself, paths are relative to serverconfig.tpmasterdir:
   &cell_boundaries=SVS/cell_boundaries.csv&nucleus_boundaries=SVS/nucleus_boundaries.csv
 CSV columns: cell_id, vertex_x, vertex_y (µm); rows of one cell are contiguous
 and its first vertex is repeated last to close the polygon.

 &cell_types=1 fills every cell by its cell_type column (when the boundaries
 CSV has one); &cell_types=Tumor,B cells fills only the listed types. Colors
 are assigned over all types, so a type keeps its color across filters.

 &annotation_level=n limits the boundary strokes to the n most zoomed-in levels
 of the viewer: zoomed out beyond that, the boundaries are hidden. Omit to
 always show. Gene expression fills are not affected — they show at all zooms.

 While the boundaries are visible (within annotation_level), hovering over a
 cell shows a tooltip with its id, its cell_type (when the CSV carries one),
 and its per-gene transcript counts (when gene overlays are loaded).

 Gene expression overlay (needs cell_boundaries):
   &gene_expression_file=SVS/cell_feature_matrix.h5&gene_expression=ACE2,ACTA2
 draws one fill overlay per comma-separated gene, each in its own color (see
 GENE_COLORS), shaded by that gene's transcript count in the cell (10x
 cell_feature_matrix HDF5; cell ids match the boundary CSV's). A legend
 overlaid on the map's top-right corner shows each gene's color gradient and
 count range; cells expressing several genes blend their fills.
 An unknown gene name surfaces an error in the UI (other genes still render).
 When the cell-type overlay is shown, expression fills/legend are suppressed
 (never both fills at once) — counts still appear in the hover tooltip.

 &gene_groups=g1,g2,g3 instead sums each cell's counts over all listed genes
 and draws ONE overlay of the totals in a single color. Can be combined with
 gene_expression (the group takes the next unused palette color).

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
import { dofetch3 } from '#common/dofetch' // fetch wrapper for meta/genecounts
import { sayerror } from '#dom' // inline error banner

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
		cellBoundaries?: string
		/** fetch cellBoundaries (expression fills need the polygons) but don't draw their strokes */
		hideCellStrokes?: boolean
		/** fill each cell by the cell_type column of the boundaries CSV (when
		 present), one categorical color per type, with a legend */
		showCellTypes?: boolean
		/** comma-separated cell types to fill; empty/undefined = all types.
		 Colors are assigned over ALL types by abundance, so a type keeps its
		 color when the filter changes */
		cellTypeFilter?: string
		nucleusBoundaries?: string
		annotationLevel?: string | number
		geneExpression?: string
		geneExpressionFile?: string
		geneGroups?: string
		/** fetch the gene counts (hover tooltip reports them) but draw no
		 expression fills/legend — the mass burger's unchecked 'Gene expression' */
		hideExpressionFills?: boolean
		/** map div size; defaults fit the full-window direct viewer */
		width?: string
		height?: string
	},
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
		const planes: number = meta.planes || 1
		let plane = Math.floor(planes / 2)

		const makeSource = (p: number) =>
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
			const bar = holder.append('div').style('font', '12px system-ui').style('padding', '4px 8px')
			bar.append('span').text('z-plane: ')
			const label = () => `${plane + 1}/${planes}` // 1-based display, e.g. '3/5'
			const planeText = bar.append('span').text(label())
			bar
				.append('input')
				.attr('type', 'range') // native slider, one notch per plane
				.attr('min', 0)
				.attr('max', planes - 1)
				.attr('step', 1)
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

		const mapDiv = holder
			.append('div')
			.style('width', opts.width ?? '100vw') // full-window unless the w2 plot passes a size
			.style('height', opts.height ?? '90vh')
		const map = new Map({
			target: mapDiv.node(), // mount the map into the holder
			layers: [slideLayer], // overlays are addLayer'd on top below
			view: new View({ resolutions: grid.getResolutions(), extent }) // camera locked to the pyramid
		})
		map.getView().fit(extent) // start fully zoomed out, whole slide visible

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

		// legends are absolute-positioned at the map's top corners, but the map is
		// taller than what's usually on screen: scrolling down moves the map's top
		// (legend included) above the viewport while the image still fills it.
		// Pin: push each legend down by however much of the map's top is hidden,
		// clamped so it never pokes out of the map's bottom either. Capture-phase
		// scroll listener also catches scrolling ancestors (mass sandbox), not
		// just the window.
		const pinned: any[] = [] // legend selections to keep in view
		const repin = () => {
			const node = mapDiv.node()
			if (!node.isConnected) return window.removeEventListener('scroll', repin, true) // viewer re-rendered
			const r = node.getBoundingClientRect()
			for (const box of pinned) {
				const top = Math.min(Math.max(8, 8 - r.top), Math.max(8, r.height - box.node().offsetHeight - 8))
				box.style('top', `${top}px`)
			}
		}
		window.addEventListener('scroll', repin, { capture: true, passive: true })

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

		// the two boundary overlays with their stroke colors (cell green, nucleus blue)
		const overlays: Array<[string | undefined, string]> = [
			[opts.cellBoundaries, 'rgba(0, 200, 80, 0.9)'],
			[opts.nucleusBoundaries, 'rgba(0, 150, 255, 0.9)']
		]
		let cellPolys: CellPoly[] | undefined // kept for the expression/type fills below
		let cellTypes: { [id: string]: string } | undefined // cell_id -> annotated type
		for (const [file, color] of overlays) {
			if (!file) continue // that overlay was not requested
			try {
				const { polys, cellTypes: types } = await fetchBoundaries(host, sq, file, mppX, mppY) // csv -> px polygons
				if (file === opts.cellBoundaries) {
					cellPolys = polys // expression/type fills reuse these rings
					cellTypes = types // annotation column of the same csv, if present
					if (opts.hideCellStrokes) continue // polygons fetched, strokes suppressed
				}
				map.addLayer(strokeLayer(polys, color, maxResolution)) // draw on top of the slide
			} catch (e: any) {
				sayerror(holder, `Error loading ${file}: ${e.message || e}`) // one overlay failing kills nothing else
			}
		}

		// cell-type overlay: fill each annotated cell in its type's categorical
		// color, with its own legend (top-left; the gene legend uses top-right).
		// No-op when the boundaries csv carries no cell_type column.
		// While it is shown, the gene expression FILLS are suppressed below (the
		// two fills are unreadable on top of each other) — gene counts are still
		// fetched so hovering a cell reports its expression.
		const typesShown = !!(opts.showCellTypes && cellPolys && cellTypes && Object.keys(cellTypes).length)
		if (typesShown && cellPolys && cellTypes) {
			// types ordered by abundance so colors go to the biggest populations first
			const counts: { [t: string]: number } = {}
			for (const id in cellTypes) counts[cellTypes[id]] = (counts[cellTypes[id]] || 0) + 1
			const types = Object.keys(counts).sort((a, b) => counts[b] - counts[a])
			const typeColor: { [t: string]: string } = {}
			for (const [i, t] of types.entries()) typeColor[t] = CELL_TYPE_COLORS[i % CELL_TYPE_COLORS.length]
			// optional filter: fill + legend only these types (colors unchanged)
			const wanted = (opts.cellTypeFilter || '')
				.split(',')
				.map(s => s.trim())
				.filter(Boolean)
			const shown = wanted.length ? types.filter(t => wanted.includes(t)) : types
			const shownColor: { [t: string]: string } = {}
			for (const t of shown) shownColor[t] = typeColor[t]
			map.addLayer(cellTypeLayer(cellPolys, cellTypes, shownColor))

			mapDiv.style('position', 'relative')
			const legend = mapDiv
				.append('div')
				.style('position', 'absolute')
				.style('top', '8px')
				.style('left', '40px') // clear of the OL zoom buttons (~31px wide at left 8px)
				.style('z-index', '10')
				.style('background', 'rgba(255,255,255,0.85)')
				.style('padding', '6px 10px')
				.style('border-radius', '4px')
				.style('font', '12px system-ui')
				.style('max-height', '60%')
				.style('overflow-y', 'auto')
			legend.append('div').style('font-weight', 'bold').style('margin-bottom', '2px').text('Cell type')
			for (const t of shown) {
				const row = legend.append('div').style('margin', '2px 0')
				row
					.append('span')
					.style('display', 'inline-block')
					.style('width', '10px')
					.style('height', '10px')
					.style('margin-right', '6px')
					.style('border', '1px solid #ccc')
					.style('background', `rgb(${typeColor[t]})`)
				row.append('span').text(`${t} (${counts[t]})`)
			}
			pinned.push(legend) // keep in view when the page scrolls
			repin()
		}

		// per-gene count maps kept for the hover tooltip below
		const geneCounts: { gene: string; cells: { [id: string]: number } }[] = []

		const geneList = (s?: string) =>
			(s || '')
				.split(',')
				.map(t => t.trim())
				.filter(Boolean)
		const exprGenes = geneList(opts.geneExpression) // one overlay per gene
		const groupGenes = geneList(opts.geneGroups) // summed into a single overlay
		if (exprGenes.length || groupGenes.length) {
			try {
				if (!opts.geneExpressionFile)
					throw new Error('gene_expression/gene_groups requires gene_expression_file=<h5 file>')
				if (!cellPolys) throw new Error('gene_expression/gene_groups requires cell_boundaries=<csv file>')
				// one genecounts request per gene, expr + group genes together
				const results = await Promise.all(
					[...exprGenes, ...groupGenes].map(gene =>
						dofetch3(
							`wsitiles/genecounts?${sq}&file=${encodeURIComponent(opts.geneExpressionFile!)}&gene=${encodeURIComponent(
								gene
							)}`
						).catch((e: any) => ({ error: e.message || String(e) }))
					)
				)
				// legend overlaid on the map's top-right corner — anything appended
				// below the 90vh map div lands below the fold and is never seen.
				// Created lazily so an all-errors run doesn't leave an empty box.
				let legend: any
				const addLegend = (rgb: string, name: string, max: number) => {
					if (!legend) {
						mapDiv.style('position', 'relative')
						legend = mapDiv
							.append('div')
							.style('position', 'absolute')
							.style('top', '8px')
							.style('right', '8px')
							.style('z-index', '10')
							.style('background', 'rgba(255,255,255,0.85)')
							.style('padding', '6px 10px')
							.style('border-radius', '4px')
							.style('font', '12px system-ui')
						pinned.push(legend) // keep in view when the page scrolls
						repin()
					}
					const row = legend.append('div').style('margin', '2px 0')
					row.append('span').style('margin-right', '6px').text(name)
					// alpha range mirrors expressionLayer's shades (log-scaled counts)
					row
						.append('span')
						.style('display', 'inline-block')
						.style('width', '80px')
						.style('height', '10px')
						.style('vertical-align', 'middle')
						.style('border', '1px solid #ccc')
						.style('background', `linear-gradient(to right, rgba(${rgb}, 0.15), rgba(${rgb}, 0.9))`)
					row.append('span').style('margin-left', '4px').text(`1–${max}`)
				}

				// gene_expression: one layer per gene, each its own color
				let colorIdx = 0 // next palette slot; shared with the group overlay
				for (const [i, gene] of exprGenes.entries()) {
					const r = results[i] // this gene's genecounts answer
					if (!r || r.error) {
						sayerror(holder, `Gene expression error (${gene}): ${r?.error || 'failed to load'}`)
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
							sayerror(holder, `Gene expression error (${gene}): ${r?.error || 'failed to load'}`)
							continue // skip the missing gene, keep summing the rest
						}
						found.push(gene)
						for (const id in r.cells) total[id] = (total[id] || 0) + r.cells[id] // accumulate per cell
					}
					if (found.length) {
						geneCounts.push({ gene: found.join('+'), cells: total }) // summed count in the tooltip
						if (!typesShown && !opts.hideExpressionFills) {
							// cell-type fills win; the summed counts stay hover-only
							let max = 0 // the summed overlay's own count ceiling
							for (const id in total) if (total[id] > max) max = total[id]
							const rgb = GENE_COLORS[colorIdx++ % GENE_COLORS.length] // next unused palette color
							map.addLayer(expressionLayer(cellPolys, total, max, rgb)) // ONE overlay of the totals
							addLegend(rgb, found.join('+'), max) // e.g. 'PTPRC+EPCAM'
						}
					}
				}
			} catch (e: any) {
				sayerror(holder, `Gene expression error: ${e.message || e}`)
			}
		}

		// hover tooltip: cell id, annotated type, per-gene counts. Active only
		// while the boundary strokes are visible, i.e. zoomed within
		// annotation_level (always, when that param is not set).
		if (cellPolys) {
			// per-cell bounding boxes so most cells are rejected without the ray cast
			// ponytail: linear scan over ~100k bboxes per mousemove — swap in an
			// rbush index if hovering ever feels laggy
			const boxes = cellPolys.map(c => {
				const xs = c.ring.map(v => v[0])
				const ys = c.ring.map(v => v[1])
				return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
			})
			mapDiv.style('position', 'relative')
			const tip = mapDiv
				.append('div')
				.style('position', 'absolute')
				.style('display', 'none')
				.style('z-index', '20')
				.style('pointer-events', 'none') // never steal the pointer from the map
				.style('background', 'rgba(255,255,255,0.9)')
				.style('padding', '4px 8px')
				.style('border-radius', '4px')
				.style('font', '12px system-ui')
				.style('white-space', 'pre') // one datum per line via \n
			map.on('pointermove', (evt: any) => {
				const res = map.getView().getResolution()
				if (evt.dragging || (maxResolution !== undefined && !(typeof res == 'number' && res < maxResolution))) {
					tip.style('display', 'none') // panning, or zoomed out past annotation_level
					return
				}
				const [x, y] = evt.coordinate
				let hit: CellPoly | undefined
				for (const [i, b] of boxes.entries()) {
					if (x < b[0] || y < b[1] || x > b[2] || y > b[3]) continue
					if (pointInRing(x, y, cellPolys![i].ring)) {
						hit = cellPolys![i]
						break
					}
				}
				if (!hit) {
					tip.style('display', 'none')
					return
				}
				const rows = [`cell id: ${hit.id}`]
				const t = cellTypes?.[hit.id]
				if (t) rows.push(`cell type: ${t}`)
				for (const g of geneCounts) rows.push(`${g.gene} expression: ${(g.cells[hit.id] || 0).toFixed(1)}`)
				tip
					.style('display', 'block')
					.style('left', `${evt.pixel[0] + 12}px`)
					.style('top', `${evt.pixel[1] + 12}px`)
					.text(rows.join('\n'))
			})
		}
	} catch (e: any) {
		loading.remove()
		sayerror(holder, `WSI error: ${e.message || e}`)
	}
}

type CellPoly = { id: string; ring: number[][] }

/** even-odd ray cast: is (x, y) inside the closed ring? (exported for tests) */
export function pointInRing(x: number, y: number, ring: number[][]): boolean {
	let inside = false
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const [xi, yi] = ring[i]
		const [xj, yj] = ring[j]
		if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
	}
	return inside
}

/** Fetch a boundary CSV (via wsitiles/boundaries) and parse it into one closed
 ring per cell, keyed by the unquoted cell_id (matches h5 barcodes). */
async function fetchBoundaries(
	host: string,
	/** wsitiles query addressing the slide (slide= or dataset params) */
	sq: string,
	file: string,
	mppX: number,
	mppY: number
): Promise<{ polys: CellPoly[]; cellTypes?: { [id: string]: string } }> {
	const res = await fetch(`${host}/wsitiles/boundaries?${sq}&file=${encodeURIComponent(file)}`) // raw csv text
	if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
	return parseBoundaries(await res.text(), mppX, mppY)
}

/** Parse a boundary CSV into one closed ring per cell (exported for tests). */
export function parseBoundaries(
	text: string,
	mppX: number,
	mppY: number
): { polys: CellPoly[]; cellTypes?: { [id: string]: string } } {
	// rows: "cell_id",vertex_x,vertex_y[,...annotations] — one cell's vertices
	// are contiguous. An optional cell_type header column (added by merging a
	// per-cell annotation export into the CSV) labels every vertex row of the
	// cell with its assigned type; captured per cell for the type overlay.
	// OL's Zoomify extent is [0,-h,w,0]: x in px to the right, y in px negated.
	const lines = text.split('\n')
	const unquote = (s?: string) => (s || '').replace(/"/g, '').trim()
	const typeIdx = lines[0] ? lines[0].split(',').findIndex(h => unquote(h) == 'cell_type') : -1
	const cellTypes: { [id: string]: string } | undefined = typeIdx > 2 ? {} : undefined
	const cells: CellPoly[] = [] // finished polygons
	let ring: number[][] = [] // vertices of the cell being read
	let curId = '' // the cell those vertices belong to
	for (const line of lines) {
		const fields = line.split(',') // one vertex per row
		const [id, xs, ys] = fields
		const x = Number(xs)
		if (!xs || Number.isNaN(x)) continue // header / blank line
		if (id !== curId) {
			// a new cell_id starts: close out the previous cell's ring
			if (ring.length > 2) cells.push({ id: curId.replace(/"/g, ''), ring })
			ring = []
			curId = id
			if (cellTypes) {
				// annotation columns never contain commas, so the type is at its header index
				const t = unquote(fields[typeIdx])
				if (t) cellTypes[unquote(id)] = t // QC-filtered cells have an empty field
			}
		}
		ring.push([x / mppX, -Number(ys) / mppY]) // µm -> level-0 px, y negated for OL
	}
	if (ring.length > 2) cells.push({ id: curId.replace(/"/g, ''), ring }) // don't drop the last cell
	return { polys: cells, cellTypes }
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
	cells: CellPoly[],
	cellTypes: { [id: string]: string },
	typeColor: { [t: string]: string }
): VectorLayer {
	const byType: { [t: string]: number[][][][] } = {} // polygon lists per type
	for (const c of cells) {
		const t = cellTypes[c.id]
		if (t && typeColor[t]) (byType[t] ||= []).push([c.ring]) // typeColor doubles as the filter
	}
	const features: Feature[] = [] // one feature per type
	for (const t in byType) {
		const f = new Feature(new MultiPolygon(byType[t]))
		f.setStyle(new Style({ fill: new Fill({ color: `rgba(${typeColor[t]}, 0.45)` }) }))
		features.push(f)
	}
	return new VectorLayer({ source: new VectorSource({ features }) })
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
		f.setStyle(new Style({ fill: new Fill({ color: `rgba(${rgb}, ${alpha.toFixed(2)})` }) }))
		features.push(f)
	}
	return new VectorLayer({ source: new VectorSource({ features }) }) // fills only, no strokes
}
