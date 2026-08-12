/*
 Direct whole-slide viewer for a single file, launched via runpp URL param:
   http://localhost:3000/?SVS=SVS/slide.svs

 Optional boundary overlays (Xenium segmentation), drawn when these params name
 CSV files that sit in the same directory as the slide:
   &cell_boundaries=cell_boundaries.csv&nucleus_boundaries=nucleus_boundaries.csv
 CSV columns: cell_id, vertex_x, vertex_y (µm); rows of one cell are contiguous
 and its first vertex is repeated last to close the polygon.

 &annotation_level=n limits the overlays to the n most zoomed-in levels of the
 viewer: zoomed out beyond that, the boundaries are hidden. Omit to always show.

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
import { Stroke, Style } from 'ol/style.js'
import { dofetch3 } from '#common/dofetch'
import { sayerror } from '#dom'

export async function init(
	opts: { slide: string; cellBoundaries?: string; nucleusBoundaries?: string; annotationLevel?: string },
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
		for (const [file, color] of overlays) {
			if (!file) continue
			try {
				map.addLayer(await boundaryLayer(host, slide, file, mppX, mppY, color, maxResolution))
			} catch (e: any) {
				sayerror(holder, `Error loading ${file}: ${e.message || e}`)
			}
		}
	} catch (e: any) {
		loading.remove()
		sayerror(holder, `WSI error: ${e.message || e}`)
	}
}

/** Fetch a boundary CSV (from the slide's directory, via wsitiles/boundaries)
 and build one stroke-only vector layer holding every polygon; maxResolution
 (when set) hides the layer once the user zooms out beyond it.
 ponytail: all ~100k polygons in one MultiPolygon feature — switch to vector
 tiling if rendering within the visible zoom range ever feels sluggish. */
async function boundaryLayer(
	host: string,
	slide: string,
	file: string,
	mppX: number,
	mppY: number,
	color: string,
	maxResolution?: number
): Promise<VectorLayer> {
	const res = await fetch(`${host}/wsitiles/boundaries?slide=${slide}&file=${encodeURIComponent(file)}`)
	if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
	const text = await res.text()

	// rows: "cell_id",vertex_x,vertex_y — one cell's vertices are contiguous.
	// OL's Zoomify extent is [0,-h,w,0]: x in px to the right, y in px negated.
	const polygons: number[][][][] = []
	let ring: number[][] = []
	let curId = ''
	for (const line of text.split('\n')) {
		const [id, xs, ys] = line.split(',')
		const x = Number(xs)
		if (!xs || Number.isNaN(x)) continue // header / blank line
		if (id !== curId) {
			if (ring.length > 2) polygons.push([ring])
			ring = []
			curId = id
		}
		ring.push([x / mppX, -Number(ys) / mppY])
	}
	if (ring.length > 2) polygons.push([ring])

	return new VectorLayer({
		source: new VectorSource({ features: [new Feature(new MultiPolygon(polygons))] }),
		style: new Style({ stroke: new Stroke({ color, width: 1 }) }),
		maxResolution
	})
}
