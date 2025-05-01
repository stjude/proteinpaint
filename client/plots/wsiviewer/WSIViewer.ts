import { getCompInit } from '#rx'
import 'ol/ol.css'
import OLMap from 'ol/Map.js'
import TileLayer from 'ol/layer/Tile.js'
import Tile from 'ol/layer/Tile.js'
import View from 'ol/View.js'
import Zoomify from 'ol/source/Zoomify.js'
import OverviewMap from 'ol/control/OverviewMap.js'
import FullScreen from 'ol/control/FullScreen.js'
import { dofetch3 } from '#common/dofetch'
import type TileSource from 'ol/source/Tile'
import { WSIViewerInteractions } from '#plots/wsiviewer/interactions/WSIViewerInteractions.ts'
import type Settings from '#plots/wsiviewer/Settings.ts'
import wsiViewerDefaults from '#plots/wsiviewer/defaults.ts'
import type { SampleWSImagesResponse, WSImage, WSImagesRequest, WSImagesResponse } from '#types'
import { table2col } from '#dom/table2col'
import { Projection } from 'ol/proj'
import { RxComponentInner } from '../../types/rx.d'
import 'ol-ext/dist/ol-ext.css'
import LayerSwitcher from 'ol-ext/control/LayerSwitcher'

export default class WSIViewer extends RxComponentInner {
	// following attributes are required by rx
	private type: string

	private wsiViewerInteractions: WSIViewerInteractions

	private thumbnailsContainer: any

	constructor(opts: any) {
		super()
		this.type = 'WSIViewer'
		this.opts = opts
		this.wsiViewerInteractions = new WSIViewerInteractions(this, opts)
	}

	async main(): Promise<void> {
		const state = structuredClone(this.state)
		const settings = state.plots.find(p => p.id === this.id).settings as Settings
		const holder = this.opts.holder

		const data: SampleWSImagesResponse = await dofetch3('samplewsimages', {
			body: {
				genome: state.genome || state.vocab.genome,
				dslabel: state.dslabel || state.vocab.dslabel,
				sample_id: state.sample_id
			}
		})

		const wsimages: WSImage[] = data.sampleWSImages

		if (wsimages.length === 0) {
			holder.append('div').style('margin-left', '10px').text('No WSI images.')
			return
		}

		let wsimageLayers: Array<WSImageLayers> = []

		try {
			wsimageLayers = await this.getWSImageLayers(state, wsimages)
		} catch (e: any) {
			holder.append('div').style('margin-left', '10px').text(e.message)
			return
		}
		this.generateThumbnails(
			wsimageLayers.map(wsimageLayers => wsimageLayers.wsimage),
			settings
		)

		holder.select('div[id="wsi-viewer"]').remove()

		holder
			.append('div')
			.attr('id', 'wsi-viewer')
			.style('width', settings.imageWidth)
			.style('height', settings.imageHeight)

		const activeImage: TileLayer = wsimageLayers[settings.displayedImageIndex].wsimage
		const activeImageExtent = activeImage?.getSource()?.getTileGrid()?.getExtent()

		const map = this.getMap(wsimageLayers[settings.displayedImageIndex])

		const hasOverlay = wsimageLayers[settings.displayedImageIndex].overlay != null

		const zoomInPoints = wsimages[settings.displayedImageIndex].zoomInPoints

		if (zoomInPoints != undefined) {
			this.addZoomInEffect(activeImageExtent, zoomInPoints, map)
		}

		this.addControls(map, activeImage, hasOverlay)

		if (activeImageExtent) {
			map.getView().fit(activeImageExtent)
		}

		if (this.opts.header) {
			//If sandbox is present, add sample id and data type to the header
			this.opts.header.html(
				`${state.sample_id} <span style="font-size:.8em">${state.termdbConfig.queries.WSImages.type} images</span>`
			)
		}

		this.renderMetadata(holder, wsimageLayers, settings)
	}

	private async getWSImageLayers(state: any, wsimages: WSImage[]): Promise<WSImageLayers[]> {
		const layers: Array<WSImageLayers> = []

		const genome = state.genome || state.vocab.genome
		const dslabel = state.dslabel || state.vocab.dslabel
		const sampleId = state.sample_id

		for (let i = 0; i < wsimages.length; i++) {
			const wsimage = wsimages[i].filename

			const body: WSImagesRequest = {
				genome: genome,
				dslabel: dslabel,
				sampleId: sampleId,
				wsimage: wsimages[i].filename
			}

			const data: WSImagesResponse = await dofetch3('wsimages', { body })

			if (data.status === 'error') {
				throw new Error(`${data.error}`)
			}

			const imgWidth = data.slide_dimensions[0]
			const imgHeight = data.slide_dimensions[1]

			const queryParams = `wsi_image=${wsimage}&dslabel=${dslabel}&genome=${genome}&sample_id=${sampleId}`

			const zoomifyUrl = `/tileserver/layer/slide/${data.wsiSessionId}/zoomify/{TileGroup}/{z}-{x}-{y}@1x.jpg?${queryParams}`

			const source = new Zoomify({
				url: zoomifyUrl,
				size: [imgWidth, imgHeight],
				crossOrigin: 'anonymous',
				zDirection: -1 // Ensure we get a tile with the screen resolution or higher
			})

			const options = {
				preview: `/tileserver/layer/slide/${data.wsiSessionId}/zoomify/TileGroup0/0-0-0@1x.jpg?${queryParams}`,
				metadata: wsimages[i].metadata,
				source: source,
				baseLayer: true,
				title: 'Slide'
			}
			const layer = new TileLayer(options)

			const wsiImageLayers: WSImageLayers = {
				wsimage: layer
			}

			const overlays = wsimages[i].overlays

			if (overlays) {
				for (const overlay of overlays) {
					const overlayQueryParams = `wsi_image=${overlay}&dslabel=${dslabel}&genome=${genome}&sample_id=${sampleId}`

					const zoomifyOverlayLatUrl = `/tileserver/layer/overlay/${data.wsiSessionId}/zoomify/{TileGroup}/{z}-{x}-{y}@1x.jpg?${overlayQueryParams}`

					const sourceOverlay = new Zoomify({
						url: zoomifyOverlayLatUrl,
						size: [imgWidth, imgHeight],
						crossOrigin: 'anonymous',
						zDirection: -1 // Ensure we get a tile with the screen resolution or higher
					})

					const optionsOverlay = {
						preview: `/tileserver/layer/overlay/${data.wsiSessionId}/zoomify/TileGroup0/0-0-0@1x.jpg?${overlayQueryParams}`,
						metadata: wsimages[i].metadata,
						source: sourceOverlay,
						title: 'Overlay'
					}

					wsiImageLayers.overlay = new TileLayer(optionsOverlay)
				}
			}

			layers.push(wsiImageLayers)
		}
		return layers
	}

	private generateThumbnails(layers: Array<TileLayer<Zoomify>>, setting: Settings) {
		if (!this.thumbnailsContainer) {
			// First-time initialization
			const holder = this.opts.holder
			this.thumbnailsContainer = holder
				.append('div')
				.attr('id', 'thumbnails')
				.attr('data-testid', 'sjpp-thumbnails')
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
					.style('height', 'auto')
					.style('align-items', 'center')
					.style('justify-content', 'center')
					.style('border', isActive ? setting.activeThumbnailBorderStyle : setting.nonActiveThumbnailBorderStyle)
					.style('cursor', 'pointer')
					.on('click', () => {
						this.wsiViewerInteractions.thumbnailClickListener(i)
					})

				thumbnail
					.append('img')
					.attr('src', layers[i].get('preview'))
					.attr('alt', `Thumbnail ${i}`)
					.style('max-width', '100%')
					.style('height', '60px')
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

	private getMap(wSImageLayers: WSImageLayers): OLMap {
		const activeImage: TileLayer = wSImageLayers.wsimage
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
		if (wSImageLayers.overlay) {
			layers.push(wSImageLayers.overlay)
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

	private addControls(map: OLMap, firstLayer: TileLayer, hasOverlay: boolean) {
		if (hasOverlay) {
			map.addControl(
				new LayerSwitcher({
					collapsed: true,
					mouseover: true
				})
			)
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

	private renderMetadata(holder: any, layers: Array<WSImageLayers>, settings: Settings) {
		holder.select('div[id="metadata"]').remove()
		const holderDiv = holder.append('div').attr('id', 'metadata')

		const table = table2col({ holder: holderDiv })
		const metadata = layers[settings.displayedImageIndex].wsimage.get('metadata')

		if (metadata) {
			// Create table rows for each key-value pair
			Object.entries(JSON.parse(metadata)).forEach(([key, value]) => {
				const [c1, c2] = table.addRow()
				c1.html(key)
				c2.html(value)
			})
		}
	}

	private addZoomInEffect(activeImageExtent: unknown, zoomInPoints: [number, number][], map: OLMap) {
		setTimeout(() => {
			if (!activeImageExtent) return

			const imageHeight = activeImageExtent[3]

			//Calculate the center of the annotation
			const xyAvg = zoomInPoints
				.reduce(
					(acc, [x, y]) => {
						acc[0] += x
						/** Zoomify tile coordinates start top-left but OpenLayers start bottom-left.
						 * This flips the feature coordinates to match OpenLayers coordinates.*/
						const invertedY = imageHeight - y
						acc[1] += invertedY
						return acc
					},
					[0, 0]
				)
				.map(sum => sum / zoomInPoints.length)

			const view = map.getView()
			view.animate({
				center: xyAvg,
				zoom: 5,
				duration: 2000
			})
		}, 500)
	}
}

type WSImageLayers = {
	wsimage: TileLayer<Zoomify>
	overlay?: TileLayer<Zoomify>
}

export const wsiViewer = getCompInit(WSIViewer)

export const componentInit = wsiViewer

export async function getPlotConfig(opts: any) {
	return {
		chartType: 'WSIViewer',
		subfolder: 'wsiviewer',
		extension: 'ts',
		settings: wsiViewerDefaults(opts.overrides)
	}
}
