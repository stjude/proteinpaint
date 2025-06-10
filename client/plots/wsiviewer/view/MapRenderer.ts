import View from 'ol/View.js'
import { Projection } from 'ol/proj'
import type TileLayer from 'ol/layer/Tile.js'
import type { WSImageLayers } from '#plots/wsiviewer/WSIViewer.ts'
import OLMap from 'ol/Map.js'

export class MapRenderer {
	public wSImageLayers: WSImageLayers

	constructor(wSImageLayers: WSImageLayers) {
		this.wSImageLayers = wSImageLayers
	}

	getMap(): OLMap {
		const activeImage: TileLayer = this.wSImageLayers.wsimage
		const extent = activeImage?.getSource()?.getTileGrid()?.getExtent()

		// TODO Add metersPerUnit?
		const projection = new Projection({
			code: 'ZoomifyProjection',
			units: 'pixels',
			extent: extent,
			getPointResolution: function (resolution) {
				return resolution
			}
		})

		const layers = [activeImage]
		if (this.wSImageLayers.overlays) {
			for (const overlay of this.wSImageLayers.overlays) {
				layers.push(overlay)
			}
		}

		return new OLMap({
			layers: layers,
			target: 'wsi-viewer',
			view: new View({
				projection: projection,
				resolutions: activeImage.getSource()?.getTileGrid()?.getResolutions(),
				constrainOnlyCenter: true,
				center: extent || [0, 0]
			})
		})
	}
}
