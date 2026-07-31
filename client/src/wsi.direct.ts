/*
 Direct whole-slide viewer for a single file, launched via runpp URL param:
   http://localhost:3000/?SVS=/abs/path/to/slide.svs

 Bypasses datasets/samples: hits the wsitiles route with the absolute path
 directly (server-side gated by features.wsi.allowDirectSlidePath). Minimal
 pan/zoom viewer — the same OpenLayers Zoomify setup the full viewer uses.
*/
import 'ol/ol.css'
import Map from 'ol/Map.js'
import View from 'ol/View.js'
import TileLayer from 'ol/layer/Tile.js'
import Zoomify from 'ol/source/Zoomify.js'
import { dofetch3 } from '#common/dofetch'
import { sayerror } from '#dom'

export async function init(opts: { slide: string }, holder: any) {
	const loading = holder.append('div').style('margin', '20px').text(`Loading ${opts.slide} …`)
	try {
		const slide = encodeURIComponent(opts.slide)
		const meta = await dofetch3(`wsitiles/meta?slide=${slide}`)
		if (!meta || meta.error || meta.status === 'error') throw meta?.error || 'failed to load slide metadata'

		const [w, h] = meta.slide_dimensions
		const host = (sessionStorage.getItem('hostURL') || (window as any).testHost || '').replace(/\/+$/, '')

		const source = new Zoomify({
			// {z}/{x}/{y} hit wsitiles/tile; unused {TileGroup} satisfies OL's
			// requirement that a {TileGroup}/{tileIndex} placeholder be present.
			url: `${host}/wsitiles/tile/{z}/{x}/{y}?slide=${slide}&_={TileGroup}`,
			size: [w, h],
			crossOrigin: 'anonymous',
			zDirection: -1
		})
		const grid = source.getTileGrid()!
		const extent = grid.getExtent()

		loading.remove()
		const mapDiv = holder.append('div').style('width', '100vw').style('height', '90vh')
		const map = new Map({
			target: mapDiv.node(),
			layers: [new TileLayer({ source })],
			view: new View({ resolutions: grid.getResolutions(), extent })
		})
		map.getView().fit(extent)

		holder
			.append('div')
			.style('font', '12px system-ui')
			.style('padding', '4px 8px')
			.text(`${opts.slide} — ${w}×${h}px${meta.mpp ? `, ${meta.mpp.toFixed(3)} µm/px` : ''}, ${meta.levels} levels`)
	} catch (e: any) {
		loading.remove()
		sayerror(holder, `WSI error: ${e.message || e}`)
	}
}
