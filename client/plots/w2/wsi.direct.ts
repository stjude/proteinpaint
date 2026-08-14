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

 &annotation_level=n limits the boundary strokes to the n most zoomed-in levels
 of the viewer: zoomed out beyond that, the boundaries are hidden. Omit to
 always show. Gene expression fills are not affected — they show at all zooms.

 Gene expression overlay (needs cell_boundaries):
   &gene_expression_file=SVS/cell_feature_matrix.h5&gene_expression=ACE2,ACTA2
 draws one fill overlay per comma-separated gene, each in its own color (see
 GENE_COLORS), shaded by that gene's transcript count in the cell (10x
 cell_feature_matrix HDF5; cell ids match the boundary CSV's). A legend
 overlaid on the map's top-right corner shows each gene's color gradient and
 count range; cells expressing several genes blend their fills.
 An unknown gene name surfaces an error in the UI (other genes still render).

 &gene_groups=g1,g2,g3 instead sums each cell's counts over all listed genes
 and draws ONE overlay of the totals in a single color. Can be combined with
 gene_expression (the group takes the next unused palette color).

 Bypasses datasets/samples: hits the wsitiles route with a direct slide path
 (resolved relative to serverconfig.tpmasterdir; gated by features.wsi.allowDirectSlidePath). Minimal
 pan/zoom viewer — the same OpenLayers Zoomify setup the full viewer uses.
*/
import 'ol/ol.css'
import Map from 'ol/Map.js'
import View from 'ol/View.js'
import TileLayer from 'ol/layer/Tile.js'
import Zoomify from 'ol/source/Zoomify.js'
import VectorLayer from 'ol/layer/Vector.js'
import VectorSource from 'ol/source/Vector.js'
import Feature from 'ol/Feature.js'
import MultiPolygon from 'ol/geom/MultiPolygon.js'
import { Fill, Stroke, Style } from 'ol/style.js'
import { dofetch3 } from '#common/dofetch'
import { sayerror } from '#dom'

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
		nucleusBoundaries?: string
		annotationLevel?: string | number
		geneExpression?: string
		geneExpressionFile?: string
		geneGroups?: string
		/** map div size; defaults fit the full-window direct viewer */
		width?: string
		height?: string
	},
	holder: any
) {
	const name = opts.slide ?? opts.label ?? 'slide'
	const loading = holder.append('div').style('margin', '20px').text(`Loading ${name} …`)
	try {
		// every wsitiles request carries this query to address the slide
		const sq = opts.slideQuery ?? `slide=${encodeURIComponent(opts.slide!)}`
		const meta = await dofetch3(`wsitiles/meta?${sq}`)
		if (!meta || meta.error || meta.status === 'error') throw meta?.error || 'failed to load slide metadata'

		const [w, h] = meta.slide_dimensions
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
				size: [w, h],
				crossOrigin: 'anonymous',
				zDirection: -1
			})
		const source = makeSource(plane)
		const grid = source.getTileGrid()!
		const extent = grid.getExtent()

		loading.remove()

		const slideLayer = new TileLayer({ source })

		// z-plane scroll bar ABOVE the map (the 90vh map pushes anything after
		// it below the fold); swapping the tile source refetches visible tiles
		// for the chosen plane, view position unchanged
		if (planes > 1) {
			const bar = holder.append('div').style('font', '12px system-ui').style('padding', '4px 8px')
			bar.append('span').text('z-plane: ')
			const label = () => `${plane + 1}/${planes}`
			const planeText = bar.append('span').text(label())
			bar
				.append('input')
				.attr('type', 'range')
				.attr('min', 0)
				.attr('max', planes - 1)
				.attr('step', 1)
				.property('value', plane)
				.style('vertical-align', 'middle')
				.style('margin-left', '8px')
				.style('width', '200px')
				.on('change', function (this: HTMLInputElement) {
					plane = Number(this.value)
					planeText.text(label())
					slideLayer.setSource(makeSource(plane))
				})
		}

		const mapDiv = holder
			.append('div')
			.style('width', opts.width ?? '100vw')
			.style('height', opts.height ?? '90vh')
		const map = new Map({
			target: mapDiv.node(),
			layers: [slideLayer],
			view: new View({ resolutions: grid.getResolutions(), extent })
		})
		map.getView().fit(extent)

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

		// segmentation overlays: boundary CSVs are in µm, converted to level-0
		// pixels via the slide's mpp (defaulting to 1 = coords already in px)
		const [mppX, mppY] = Array.isArray(meta.mpp) && meta.mpp.length === 2 ? meta.mpp : [1, 1]

		// annotation_level=n: show the overlays only within the n most zoomed-in
		// levels. OL picks the tile level with resolution <= the view resolution,
		// so "within the n finest levels" means view resolution < the (n+1)'th
		// finest grid resolution — that becomes the layer's (exclusive) maxResolution.
		const resolutions = grid.getResolutions()
		const n = Number(opts.annotationLevel)
		const maxResolution =
			Number.isInteger(n) && n > 0 && n < resolutions.length ? resolutions[resolutions.length - 1 - n] : undefined

		const overlays: Array<[string | undefined, string]> = [
			[opts.cellBoundaries, 'rgba(0, 200, 80, 0.9)'],
			[opts.nucleusBoundaries, 'rgba(0, 150, 255, 0.9)']
		]
		let cellPolys: CellPoly[] | undefined
		for (const [file, color] of overlays) {
			if (!file) continue
			try {
				const polys = await fetchBoundaries(host, sq, file, mppX, mppY)
				if (file === opts.cellBoundaries) cellPolys = polys
				map.addLayer(strokeLayer(polys, color, maxResolution))
			} catch (e: any) {
				sayerror(holder, `Error loading ${file}: ${e.message || e}`)
			}
		}

		const geneList = (s?: string) =>
			(s || '')
				.split(',')
				.map(t => t.trim())
				.filter(Boolean)
		const exprGenes = geneList(opts.geneExpression)
		const groupGenes = geneList(opts.geneGroups)
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
				let colorIdx = 0
				for (const [i, gene] of exprGenes.entries()) {
					const r = results[i]
					if (!r || r.error) {
						sayerror(holder, `Gene expression error (${gene}): ${r?.error || 'failed to load'}`)
						continue
					}
					const rgb = GENE_COLORS[colorIdx++ % GENE_COLORS.length]
					map.addLayer(expressionLayer(cellPolys, r.cells, r.max, rgb))
					addLegend(rgb, gene, r.max)
				}

				// gene_groups: sum each cell's counts over the group, one layer/color
				if (groupGenes.length) {
					const total: { [id: string]: number } = {}
					const found: string[] = []
					for (const [i, gene] of groupGenes.entries()) {
						const r = results[exprGenes.length + i]
						if (!r || r.error) {
							sayerror(holder, `Gene expression error (${gene}): ${r?.error || 'failed to load'}`)
							continue
						}
						found.push(gene)
						for (const id in r.cells) total[id] = (total[id] || 0) + r.cells[id]
					}
					if (found.length) {
						let max = 0
						for (const id in total) if (total[id] > max) max = total[id]
						const rgb = GENE_COLORS[colorIdx++ % GENE_COLORS.length]
						map.addLayer(expressionLayer(cellPolys, total, max, rgb))
						addLegend(rgb, found.join('+'), max)
					}
				}
			} catch (e: any) {
				sayerror(holder, `Gene expression error: ${e.message || e}`)
			}
		}
	} catch (e: any) {
		loading.remove()
		sayerror(holder, `WSI error: ${e.message || e}`)
	}
}

type CellPoly = { id: string; ring: number[][] }

/** Fetch a boundary CSV (via wsitiles/boundaries) and parse it into one closed
 ring per cell, keyed by the unquoted cell_id (matches h5 barcodes). */
async function fetchBoundaries(
	host: string,
	/** wsitiles query addressing the slide (slide= or dataset params) */
	sq: string,
	file: string,
	mppX: number,
	mppY: number
): Promise<CellPoly[]> {
	const res = await fetch(`${host}/wsitiles/boundaries?${sq}&file=${encodeURIComponent(file)}`)
	if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
	const text = await res.text()

	// rows: "cell_id",vertex_x,vertex_y — one cell's vertices are contiguous.
	// OL's Zoomify extent is [0,-h,w,0]: x in px to the right, y in px negated.
	const cells: CellPoly[] = []
	let ring: number[][] = []
	let curId = ''
	for (const line of text.split('\n')) {
		const [id, xs, ys] = line.split(',')
		const x = Number(xs)
		if (!xs || Number.isNaN(x)) continue // header / blank line
		if (id !== curId) {
			if (ring.length > 2) cells.push({ id: curId.replace(/"/g, ''), ring })
			ring = []
			curId = id
		}
		ring.push([x / mppX, -Number(ys) / mppY])
	}
	if (ring.length > 2) cells.push({ id: curId.replace(/"/g, ''), ring })
	return cells
}

/** One stroke-only vector layer holding every polygon; maxResolution (when
 set) hides the layer once the user zooms out beyond it.
 ponytail: all ~100k polygons in one MultiPolygon feature — switch to vector
 tiling if rendering within the visible zoom range ever feels sluggish. */
function strokeLayer(cells: CellPoly[], color: string, maxResolution?: number): VectorLayer {
	return new VectorLayer({
		source: new VectorSource({ features: [new Feature(new MultiPolygon(cells.map(c => [c.ring])))] }),
		style: new Style({ stroke: new Stroke({ color, width: 1 }) }),
		maxResolution
	})
}

const SHADES = 8

// fill colors ("r, g, b") cycled per gene; green/blue-ish avoided so fills
// stay distinguishable from the cell (green) and nucleus (blue) strokes
const GENE_COLORS = ['255, 0, 0', '0, 90, 255', '255, 165, 0', '160, 0, 200', '0, 160, 160', '200, 160, 0']

/** Fill each expressing cell with `rgb` at an opacity scaling with the cell's
 transcript count for the chosen gene; zero-count cells stay unfilled. Cells
 are bucketed into SHADES opacity steps so the layer is a handful of
 MultiPolygon features instead of one per cell. Counts are log-normalized
 (log1p(n)/log1p(max)) so a few hot cells don't push everything else into
 the faintest shade. Shown at every zoom level — annotation_level only
 gates the boundary strokes, not the expression fills. */
function expressionLayer(cells: CellPoly[], counts: { [id: string]: number }, max: number, rgb: string): VectorLayer {
	const buckets: number[][][][][] = Array.from({ length: SHADES }, () => [])
	for (const c of cells) {
		const n = counts[c.id]
		if (!n || !max) continue
		buckets[Math.min(SHADES - 1, Math.floor((Math.log1p(n) / Math.log1p(max)) * SHADES))].push([c.ring])
	}
	const features: Feature[] = []
	for (const [i, polys] of buckets.entries()) {
		if (!polys.length) continue
		const f = new Feature(new MultiPolygon(polys))
		const alpha = 0.15 + (0.75 * (i + 1)) / SHADES
		f.setStyle(new Style({ fill: new Fill({ color: `rgba(${rgb}, ${alpha.toFixed(2)})` }) }))
		features.push(f)
	}
	return new VectorLayer({ source: new VectorSource({ features }) })
}
