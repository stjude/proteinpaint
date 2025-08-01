import View from 'ol/View.js'
import { Projection } from 'ol/proj'
import type TileLayer from 'ol/layer/Tile.js'
import OLMap from 'ol/Map.js'
import Tile from 'ol/layer/Tile.js'
import OverviewMap from 'ol/control/OverviewMap.js'
import FullScreen from 'ol/control/FullScreen.js'
import type TileSource from 'ol/source/Tile'
import LayerSwitcher from 'ol-ext/control/LayerSwitcher'
import MousePosition from 'ol/control/MousePosition.js'
import { format as formatCoordinate } from 'ol/coordinate.js'
import type { WSImageLayers } from '#plots/wsiviewer/viewModel/WSImageLayers.ts'
import type Layer from 'ol/layer/Layer'

export class MapRenderer {
	public wSImageLayers: WSImageLayers

	constructor(wSImageLayers: WSImageLayers) {
		this.wSImageLayers = wSImageLayers
	}

	public getMap(): OLMap {
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

		const layers: Array<Layer> = [activeImage]
		if (this.wSImageLayers.overlays) {
			for (const overlay of this.wSImageLayers.overlays) {
				layers.push(overlay)
			}
		}

		const map = new OLMap({
			layers: layers,
			target: 'wsi-viewer',
			view: new View({
				projection: projection,
				resolutions: activeImage.getSource()?.getTileGrid()?.getResolutions(),
				constrainOnlyCenter: true,
				center: extent || [0, 0]
			})
		})

		const hasOverlay = this.wSImageLayers.overlays != null

		this.addControls(map, activeImage, hasOverlay)

		return map
	}

	private addControls(map: OLMap, firstLayer: TileLayer, hasOverlay: boolean) {
		if (hasOverlay) {
			map.addControl(
				new LayerSwitcher({
					collapsed: true,
					mouseover: true
				})
			)

			// Display the mouse position in the upper right corner
			// Uncomment import statements above to use
			const coordinateFormat = function (coordinate) {
				coordinate = [coordinate[0], -coordinate[1]]
				return formatCoordinate(coordinate, '{x}, {y}', 0)
			}
			const mousePositionControl = new MousePosition({
				coordinateFormat: coordinateFormat,
				// TODO Reuse projection from the map creation?
				projection: undefined,
				className: 'ol-mouse-position',
				placeholder: '&nbsp;'
			})

			map.addControl(mousePositionControl)

			// //Console.log the mouse position
			// map.on('singleclick', function (event) {
			// 	const coordinate = event.coordinate
			// 	const flipped = [coordinate[0], -coordinate[1]] // Flip Y if needed
			// 	console.log(`Mouse position: ${flipped[0]}, ${flipped[1]}`)
			// })
		}

		const fullscreen = new FullScreen()
		map.addControl(fullscreen)

		const overviewMapControl = new OverviewMap({
			className: 'ol-overviewmap ol-custom-overviewmap',
			layers: [
				new Tile({
					source: firstLayer.getSource() as TileSource
				})
			]
		})

		map.addControl(overviewMapControl)
	}
}
