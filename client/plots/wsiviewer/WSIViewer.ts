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
import TileSource from 'ol/source/Tile'
import { WSIViewerInteractions } from '#plots/wsiviewer/interactions/WSIViewerInteractions.ts'
import Settings from '#plots/wsiviewer/Settings.ts'
import wsiViewerDefaults from '#plots/wsiviewer/defaults.ts'
import { GetWSImagesRequest, GetWSImagesResponse } from '../../shared/types/routes/wsimages.ts'
import wsiViewerImageFiles from '#plots/wsiviewer/images.ts'
import { copyMerge } from '#rx'

export default class WSIViewer {
	// following attributes are required by rx
	private type: string
	private id: any
	private opts: any
	private app: any

	private wsiViewerInteractions: WSIViewerInteractions

	private thumbnailsContainer: any

	constructor(opts: any) {
		this.type = 'WSIViewer'
		this.opts = opts
		this.wsiViewerInteractions = new WSIViewerInteractions(this, opts)
	}

	async main(): Promise<void> {
		const state = this.app.getState()

		const plotConfig = state.plots.find(p => p.id === this.id)

		const settings = plotConfig.settings as Settings

		const holder = this.opts.holder

		if (plotConfig.wsimages.length === 0) {
			holder.append('div').style('margin-left', '10px').text('No WSI images.')
			return
		}

		const layers = await this.getLayers(state, plotConfig.wsimages)

		if (layers.length === 0) {
			holder
				.append('div')
				.style('margin-left', '10px')
				.text('There was an error loading the WSI images. Please try again later.')
			return
		}

		this.generateThumbnails(layers, settings)

		holder.select('div[id="wsi-viewer"]').remove()

		holder
			.append('div')
			.attr('id', 'wsi-viewer')
			.style('width', settings.imageWidth)
			.style('height', settings.imageHeight)

		const activeImage: TileLayer = layers[settings.displayedImageIndex]
		const activeImageExtent = activeImage?.getSource()?.getTileGrid()?.getExtent()

		const map = this.getMap(activeImage)

		this.addControls(map, activeImage)

		if (activeImageExtent) {
			map.getView().fit(activeImageExtent)
		}
	}

	private generateThumbnails(layers: Array<TileLayer<Zoomify>>, setting: Settings) {
		if (!this.thumbnailsContainer) {
			// First-time initialization
			const holder = this.opts.holder
			this.thumbnailsContainer = holder
				.append('div')
				.attr('id', 'thumbnails')
				.style('width', '600px')
				.style('height', '80px')
				.style('display', 'flex')
				.style('margin-left', '20px')
				.style('margin-bottom', '20px')

			for (let i = 0; i < layers.length; i++) {
				const isActive = i === setting.displayedImageIndex
				const thumbnail = this.thumbnailsContainer
					.append('div')
					.attr('id', `thumbnail${i}`)
					.style('width', setting.thumbnailWidth)
					.style('height', setting.thumbnailHeight)
					.style('margin-right', '10px')
					.style('display', 'flex')
					.style('align-items', 'center')
					.style('justify-content', 'center')
					.style('border', isActive ? setting.activeThumbnailBorderStyle : setting.nonActiveThumbnailBorderStyle)
					.on('click', () => {
						this.wsiViewerInteractions.thumbnailClickListener(i)
					})

				thumbnail
					.append('img')
					.attr('src', layers[i].get('preview'))
					.attr('alt', `Thumbnail ${i}`)
					.style('max-width', '100%')
					.style('height', 'auto')
					.style('object-fit', 'cover')
			}
		} else {
			// Update borders only
			for (let i = 0; i < layers.length; i++) {
				const isActive = i === setting.displayedImageIndex
				this.thumbnailsContainer
					.select(`#thumbnail${i}`)
					.style('border', isActive ? setting.activeThumbnailBorderStyle : setting.nonActiveThumbnailBorderStyle)
			}
		}
	}

	private getMap(displayedImage: TileLayer) {
		return new Map({
			layers: [displayedImage],
			target: 'wsi-viewer',
			view: new View({
				resolutions: displayedImage.getSource()?.getTileGrid()?.getResolutions()
			})
		})
	}

	private addControls(map: Map, firstLayer: TileLayer) {
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

	private async getLayers(state: any, wsimages: string[]): Promise<Array<TileLayer<Zoomify>>> {
		const layers: Array<TileLayer<Zoomify>> = []

		for (let i = 0; i < wsimages.length; i++) {
			const body: GetWSImagesRequest = {
				genome: state.genome || state.vocab.genome,
				dslabel: state.dslabel || state.vocab.dslabel,
				sampleId: state.sample_id,
				wsimage: wsimages[i]
			}

			const data: GetWSImagesResponse = await dofetch3('wsimages', { body })

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
				baseLayer: true
			}

			const layer = new TileLayer(options)

			layers.push(layer)
		}
		return layers
	}
}

export const wsiViewer = getCompInit(WSIViewer)

export const componentInit = wsiViewer

export async function getPlotConfig(opts: any, app: any) {
	const config = {
		chartType: 'WSIViewer',
		subfolder: 'wsiviewer',
		extension: 'ts',
		wsimages: await wsiViewerImageFiles({ app }),
		settings: wsiViewerDefaults(opts.overrides)
	}
	return copyMerge(config, opts)
}
