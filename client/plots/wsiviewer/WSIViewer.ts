import { getCompInit } from '#rx'
import 'ol/ol.css'
import OLMap from 'ol/Map.js'
import type TileLayer from 'ol/layer/Tile.js'
import Tile from 'ol/layer/Tile.js'
import View from 'ol/View.js'
import type Zoomify from 'ol/source/Zoomify.js'
import OverviewMap from 'ol/control/OverviewMap.js'
import FullScreen from 'ol/control/FullScreen.js'
import { dofetch3 } from '#common/dofetch'
import type TileSource from 'ol/source/Tile'
import { WSIViewerInteractions } from '#plots/wsiviewer/interactions/WSIViewerInteractions.ts'
import type Settings from '#plots/wsiviewer/Settings.ts'
import wsiViewerDefaults from '#plots/wsiviewer/defaults.ts'
import type { SampleWSImagesResponse } from '#types'
import { table2col } from '#dom'
import { Projection } from 'ol/proj'
import { RxComponentInner } from '../../types/rx.d'
import 'ol-ext/dist/ol-ext.css'
import LayerSwitcher from 'ol-ext/control/LayerSwitcher'
import MousePosition from 'ol/control/MousePosition.js'
import { format as formatCoordinate } from 'ol/coordinate.js'
import { debounce } from 'debounce'
import { WSImageRenderer } from '#plots/wsiviewer/view/WSImageRenderer.ts'
import { Buffer } from '#plots/wsiviewer/interactions/Buffer.ts'
import { ViewModelProvider } from '#plots/wsiviewer/viewModelNew/ViewModelProvider.ts'
import { ThumbnailRenderer } from '#plots/wsiviewer/view/ThumbnailRenderer.ts'

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

		//TODO: Maybe index comes from state? or ds.queries?
		const buffers = {
			annotationsIdx: new Buffer<number>(0)
		}

		// TODO verify if state.vocab.genome is needed?
		const genome = state.genome || state.vocab.genome
		const dslabel = state.dslabel || state.vocab.dslabel
		const sample_id = state.sample_id

		const viewModelProvider = new ViewModelProvider()
		const viewModelNew = await viewModelProvider.provide(
			genome,
			dslabel,
			sample_id,
			buffers.annotationsIdx.get(),
			settings
		)
		const wsimages = viewModelNew.sampleWSImages
		const wsimageLayers = viewModelNew.wsimageLayers
		const wsimageLayersLoadError = viewModelNew.wsimageLayersLoadError

		if (wsimages.length === 0) {
			holder.append('div').style('margin-left', '10px').text('No WSI images.')
			return
		}

		if (wsimageLayersLoadError) {
			holder.append('div').style('margin-left', '10px').text(wsimageLayersLoadError)
			return
		}

		const thumbnailRenderer = new ThumbnailRenderer()

		this.thumbnailsContainer = thumbnailRenderer.render(
			holder,
			this.thumbnailsContainer,
			wsimageLayers.map(wsimageLayers => wsimageLayers.wsimage),
			settings,
			this.wsiViewerInteractions
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

		const viewData = viewModelNew.getViewData(wsimages[settings.displayedImageIndex])

		const hasOverlay = wsimageLayers[settings.displayedImageIndex].overlays != null

		const zoomInPoints = wsimages[settings.displayedImageIndex].zoomInPoints

		new WSImageRenderer(holder, viewData, buffers, this.wsiViewerInteractions, activeImageExtent, map)

		if (zoomInPoints != undefined) {
			this.wsiViewerInteractions.addZoomInEffect(activeImageExtent, zoomInPoints, map)

			this.addMapKeyDownListener(
				holder,
				state,
				map,
				settings,
				activeImageExtent,
				viewData.shortcuts,
				buffers,
				viewModelProvider
			)
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
		if (wSImageLayers.overlays) {
			for (const overlay of wSImageLayers.overlays) {
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

			//Console.log the mouse position
			map.on('singleclick', function (event) {
				const coordinate = event.coordinate
				const flipped = [coordinate[0], -coordinate[1]] // Flip Y if needed
				console.log(`Mouse position: ${flipped[0]}, ${flipped[1]}`)
			})
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

	private addMapKeyDownListener(
		holder: any,
		state: any,
		map: OLMap,
		settings: Settings,
		activeImageExtent: any,
		shortcuts: string[] = [],
		buffers: any,
		// TODO deal with this in a better way
		viewModelProvider: ViewModelProvider
	) {
		// Add keydown listener to the image container
		const image = holder.select('div > .ol-viewport').attr('tabindex', 0)

		//To scroll to next annotation, hold the space bar and press left/right arrows
		let isSpaceDown = false

		image.on('keydown', async (event: KeyboardEvent) => {
			let currentIndex = buffers.annotationsIdx.get()

			if (event.code === 'Space') {
				isSpaceDown = true
			}
			if (isSpaceDown) {
				event.preventDefault()
				event.stopPropagation()
				const idx = currentIndex
				if (event.key == 'ArrowRight') {
					//TODO: length of annotations?
					currentIndex += 1
				}
				if (event.key == 'ArrowLeft') {
					//Do not react if at the starting annotation
					if (currentIndex === 0) return
					currentIndex -= 1
				}
				if (idx !== currentIndex) {
					//When the index changes, scroll to the new annotation
					//Timeout for when user presses arrows multiple times.
					const d = debounce(async () => {
						buffers.annotationsIdx.set(currentIndex)
						const newData: SampleWSImagesResponse = await viewModelProvider.requestData(
							state.genome,
							state.dslabel,
							state.sample_id,
							buffers.annotationsIdx.get()
						)
						const newZoomInPoints = newData.sampleWSImages[settings.displayedImageIndex].zoomInPoints
						if (newZoomInPoints != undefined)
							this.wsiViewerInteractions.addZoomInEffect(activeImageExtent, newZoomInPoints, map)
						isSpaceDown = false
					}, 500)
					d()
				}
			}
			if (shortcuts.includes(event.code)) {
				const body = {
					//I'd rather come up with an id since
					//the index provided and the index used are
					//not the same.
					index: buffers.annotationsIdx.get(),
					confirmed: event.code === 'Enter',
					class: event.code === 'Enter' ? null : event.code.replace('Digit', '').replace('Key', '')
				}
				//Send user confirmation or change to server
				await dofetch3('sampleWsiAiApi', { body })
			}
		})
	}
}

type WSImageLayers = {
	wsimage: TileLayer<Zoomify>
	overlays?: Array<TileLayer<Zoomify>>
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
