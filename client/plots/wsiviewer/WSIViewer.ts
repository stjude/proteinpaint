import { getCompInit } from '#rx'
import 'ol/ol.css'
import Map from 'ol/Map.js'
import TileLayer from 'ol/layer/Tile.js'
import Tile from 'ol/layer/Tile.js'
import View from 'ol/View.js'
import Zoomify from 'ol/source/Zoomify.js'
import OverviewMap from 'ol/control/OverviewMap.js'
import FullScreen from 'ol/control/FullScreen.js'
import { dofetch3 } from '#common/dofetch'
import 'ol-ext/dist/ol-ext.css'
import LayerSwitcherImage from 'ol-ext/control/LayerSwitcherImage'
import TileSource from 'ol/source/Tile'
import { Layer } from 'ol/layer'
import Collection from 'ol/Collection'
import BaseLayer from 'ol/layer/Base'

export default class WSIViewer {
	// following attributes are required by rx
	private type: string
	private opts: any
	private app: any

	constructor(opts: any) {
		this.type = 'WSIViewer'
		this.opts = opts
	}

	async init() {
		const state = this.app.getState()
		const holder = this.opts.holder
		if (state.wsimages.length === 0) {
			holder.append('div').text('No WSI images.')
			return
		}

		const layers = await this.getLayers(state)

		if (layers.length === 0) {
			holder.append('div').text('There was an error loading the WSI images. Please try again later.')
			return
		}

		holder.append('div').attr('id', 'wsi-viewer').style('width', '600px').style('height', '600px')

		const firstLayer: TileLayer = layers.values()[0]
		const firstExtent = firstLayer?.getSource()?.getTileGrid()?.getExtent()

		const map = this.getMap(layers, firstLayer)

		this.addControls(map, firstLayer)

		if (firstExtent) {
			map.getView().fit(firstExtent)
		}
	}

	private getMap(layers: Array<TileLayer<Zoomify>>, firstLayer: TileLayer) {
		return new Map({
			layers: Array.from(layers.values()),
			target: 'wsi-viewer',
			view: new View({
				resolutions: firstLayer.getSource()?.getTileGrid()?.getResolutions()
			})
		})
	}

	private addControls(map: Map, firstLayer: TileLayer) {
		map.addControl(new LayerSwitcherImage({ collapsed: true }))

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

		map.getLayers().forEach(layer => {
			layer.on('change:visible', () => {
				const layer = this.findLastVisible(map.getLayers())
				const extent = (layer as TileLayer)?.getSource()?.getTileGrid()?.getExtent()

				if (extent) {
					map.getView().fit(extent)
					map.getView().changed()
				}

				overviewMapControl.getOverviewMap().getLayers().clear()
				overviewMapControl
					.getOverviewMap()
					.getLayers()
					.push(
						new Tile({
							source: layer.getSource() as TileSource
						})
					)
			})
		})
	}

	private async getLayers(state: any) {
		const layers: Array<TileLayer<Zoomify>> = []

		for (let i = 0; i < state.wsimages.length; i++) {
			const body = {
				genome: state.genome,
				dslabel: state.dslabel,
				sampleId: state.sample_id,
				wsimage: state.wsimages[i]
			}

			const data = await dofetch3('wsimages', { body })

			if (data.status === 'error') {
				return []
			}

			const imgWidth = data.slide_dimensions[0]
			const imgHeight = data.slide_dimensions[1]

			const zoomifyUrl = `/tileserver/layer/slide/${data.sessionId}/zoomify/{TileGroup}/{z}-{x}-{y}@1x.jpg`

			const source = new Zoomify({
				url: zoomifyUrl,
				size: [imgWidth, imgHeight],
				crossOrigin: 'anonymous',
				zDirection: -1 // Ensure we get a tile with the screen resolution or higher
			})

			const options = {
				// title: "Set Title",
				preview: `/tileserver/layer/slide/${data.sessionId}/zoomify/TileGroup0/0-0-0@1x.jpg`,
				source: source,
				baseLayer: true,
				visible: i === 0
			}
			const layer = new TileLayer(options)

			layers.push(layer)
		}
		return layers
	}

	findLastVisible(layers: Collection<BaseLayer>): Layer {
		let lastVisibleIndex = -1
		for (let i = layers.getLength() - 1; i >= 0; i--) {
			if (layers.getArray()[i].getVisible()) {
				lastVisibleIndex = i
				break
			}
		}

		return layers.getArray()[lastVisibleIndex] as Layer
	}
}

export const wsiViewer = getCompInit(WSIViewer)

export const componentInit = wsiViewer

export async function getPlotConfig() {
	return {
		chartType: 'WSIViewer',
		subfolder: 'wsiviewer',
		extension: 'ts'
	}
}
