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

 &annotation_level=n limits the overlays to the n most zoomed-in levels of the
 viewer: zoomed out beyond that, the boundaries are hidden. Omit to always show.

 Gene expression overlay (needs cell_boundaries):
   &gene_expression_file=SVS/cell_feature_matrix.h5&gene_expression=ACE2
 fills each cell boundary with a shade of red proportional to that gene's
 transcript count in the cell (10x cell_feature_matrix HDF5; cell ids match the
 boundary CSV's). An unknown gene name surfaces an error in the UI.

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
		slide: string
		cellBoundaries?: string
		nucleusBoundaries?: string
		annotationLevel?: string
		geneExpression?: string
		geneExpressionFile?: string
	},
	holder: any
) {
	const loading = holder.append('div').style('margin', '20px').text(`Loading ${opts.slide} …`)
	try {
		const slide = encodeURIComponent(opts.slide)
		const meta = await dofetch3(`wsitiles/meta?slide=${slide}`)
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
				url: `${host}/wsitiles/tile/{z}/{x}/{y}?slide=${slide}${planes > 1 ? `&plane=${p}` : ''}&_={TileGroup}`,
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

		const mapDiv = holder.append('div').style('width', '100vw').style('height', '90vh')
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
				`${opts.slide} — ${w}×${h}px${
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
				const polys = await fetchBoundaries(host, slide, file, mppX, mppY)
				if (file === opts.cellBoundaries) cellPolys = polys
				map.addLayer(strokeLayer(polys, color, maxResolution))
			} catch (e: any) {
				sayerror(holder, `Error loading ${file}: ${e.message || e}`)
			}
		}

		if (opts.geneExpression) {
			try {
				if (!opts.geneExpressionFile) throw new Error('gene_expression requires gene_expression_file=<h5 file>')
				if (!cellPolys) throw new Error('gene_expression requires cell_boundaries=<csv file>')
				const r = await dofetch3(
					`wsitiles/genecounts?slide=${slide}&file=${encodeURIComponent(
						opts.geneExpressionFile
					)}&gene=${encodeURIComponent(opts.geneExpression)}`
				)
				if (!r || r.error) throw new Error(r?.error || 'failed to load gene expression')
				map.addLayer(expressionLayer(cellPolys, r.cells, r.max, maxResolution))
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
	slide: string,
	file: string,
	mppX: number,
	mppY: number
): Promise<CellPoly[]> {
	const res = await fetch(`${host}/wsitiles/boundaries?slide=${slide}&file=${encodeURIComponent(file)}`)
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

/** Fill each expressing cell with red whose opacity scales with the cell's
 transcript count for the chosen gene; zero-count cells stay unfilled. Cells
 are bucketed into SHADES opacity steps so the layer is a handful of
 MultiPolygon features instead of one per cell.
 ponytail: linear count->shade scale; switch to log if one hot cell washes
 out the rest. */
function expressionLayer(
	cells: CellPoly[],
	counts: { [id: string]: number },
	max: number,
	maxResolution?: number
): VectorLayer {
	const buckets: number[][][][][] = Array.from({ length: SHADES }, () => [])
	for (const c of cells) {
		const n = counts[c.id]
		if (!n || !max) continue
		buckets[Math.min(SHADES - 1, Math.floor((n / max) * SHADES))].push([c.ring])
	}
	const features: Feature[] = []
	for (const [i, polys] of buckets.entries()) {
		if (!polys.length) continue
		const f = new Feature(new MultiPolygon(polys))
		const alpha = 0.15 + (0.75 * (i + 1)) / SHADES
		f.setStyle(new Style({ fill: new Fill({ color: `rgba(255, 0, 0, ${alpha.toFixed(2)})` }) }))
		features.push(f)
	}
	return new VectorLayer({ source: new VectorSource({ features }), maxResolution })
}
