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
import type Settings from '../Settings'
import type { SessionWSImage } from '#plots/wsiviewer/viewModel/SessionWSImage.ts'

export class MapRenderer {
	public wSImageLayers: WSImageLayers
	private viewerClickListener: (
		coordinateX: number,
		coordinateY: number,
		sessionWSImage: SessionWSImage,
		buffers: any,
		map: OLMap
	) => void
	private sessionWSImage: SessionWSImage
	private buffers: any
	private settings: Settings

	constructor(
		wSImageLayers: WSImageLayers,
		viewerClickListener: {
			(coordinateX: number, coordinateY: number, sessionWSImage: SessionWSImage, buffers: any, map: OLMap): void
		},
		sessionWSImage: SessionWSImage,
		buffers: any,
		settings: Settings
	) {
		this.wSImageLayers = wSImageLayers
		this.sessionWSImage = sessionWSImage
		this.viewerClickListener = viewerClickListener
		this.buffers = buffers
		this.settings = settings
	}

	public render(holder: any, settings: Settings): OLMap {
		holder.select('div[id="wsi-viewer"]').remove()

		holder
			.append('div')
			.attr('id', 'wsi-viewer')
			.style('width', settings.imageWidth)
			.style('height', settings.imageHeight)
			.style('display', 'none') // Initially hidden

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

	private addControls(map: OLMap, activeImage: TileLayer, hasOverlay: boolean) {
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

			map.on('singleclick', event => {
				const coordinate = event.coordinate
				const tileSize = this.settings.tileSize
				// Compute upper-left corner of the tile containing the clicked point
				const tileX = Math.floor(coordinate[0] / tileSize) * tileSize
				const tileY = Math.floor(-coordinate[1] / tileSize) * tileSize

				// Call the listener with upper-left corner
				this.viewerClickListener(tileX, tileY, this.sessionWSImage, this.buffers, map)
			})
		}

		const fullscreen = new FullScreen()
		map.addControl(fullscreen)

		const overviewMapControl = new OverviewMap({
			className: 'ol-overviewmap ol-custom-overviewmap',
			layers: [
				new Tile({
					source: activeImage.getSource() as TileSource
				})
			]
		})

		map.addControl(overviewMapControl)
	}
}
