import type Settings from '#plots/wsiviewer/Settings.ts'
import { dofetch3 } from '#common/dofetch'
import type { SampleWSImagesResponse, WSImage, WSImagesRequest, WSImagesResponse } from '@sjcrh/proteinpaint-types'
import { ViewModel } from '#plots/wsiviewer/viewModel/ViewModel.ts'
import type { WSImageLayers } from '#plots/wsiviewer/viewModel/WSImageLayers.ts'
import Zoomify from 'ol/source/Zoomify'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'

export class ViewModelProvider {
	constructor() {}

	async provide(genome: string, dslabel: string, sampleId: string, index, settings: Settings): Promise<ViewModel> {
		const data: SampleWSImagesResponse = await this.requestData(genome, dslabel, sampleId, index)

		let wsimageLayers: Array<WSImageLayers> = []
		let wsimageLayersLoadError: string | undefined = undefined

		try {
			wsimageLayers = await this.getWSImageLayers(genome, dslabel, sampleId, data.sampleWSImages)
		} catch (e: any) {
			wsimageLayersLoadError = `Error loading image layers for sample  ${sampleId}: ${e.message || e}`
		}

		if (settings) {
			//tmp fix to resolve ts error
		}

		return new ViewModel(data.sampleWSImages, wsimageLayers, wsimageLayersLoadError)
	}

	public async requestData(
		genome: string,
		dslabel: string,
		sample_id: string,
		index: any
	): Promise<SampleWSImagesResponse> {
		return await dofetch3('samplewsimages', {
			body: {
				genome: genome,
				dslabel: dslabel,
				sample_id: sample_id,
				index
			}
		})
	}

	private async getWSImageLayers(
		genome: string,
		dslabel: string,
		sampleId: string,
		wsimages: WSImage[]
	): Promise<WSImageLayers[]> {
		const layers: Array<WSImageLayers> = []

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

			if (data.overlays) {
				for (const overlay of data.overlays) {
					const predictionQueryParams = `wsi_image=${wsimage}&dslabel=${dslabel}&genome=${genome}&sample_id=${sampleId}`
					const zoomifyOverlayLatUrl = `/tileserver/layer/${overlay.layerNumber}/${data.wsiSessionId}/zoomify/{TileGroup}/{z}-{x}-{y}@1x.jpg?${predictionQueryParams}`

					const sourceOverlay = new Zoomify({
						url: zoomifyOverlayLatUrl,
						size: [imgWidth, imgHeight],
						crossOrigin: 'anonymous',
						zDirection: -1 // Ensure we get a tile with the screen resolution or higher
					})

					const optionsOverlay = {
						preview: `/tileserver/layer/${overlay.layerNumber}/${data.wsiSessionId}/zoomify/TileGroup0/0-0-0@1x.jpg?${predictionQueryParams}`,
						metadata: wsimages[i].metadata,
						source: sourceOverlay,
						title: overlay.predictionOverlayType
					}

					if (wsiImageLayers.overlays) {
						wsiImageLayers.overlays.push(new TileLayer(optionsOverlay))
					} else {
						wsiImageLayers.overlays = [new TileLayer(optionsOverlay)]
					}
				}
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
						title: 'Selected Patches'
					}

					if (wsiImageLayers.overlays) {
						wsiImageLayers.overlays.push(new TileLayer(optionsOverlay))
					} else {
						wsiImageLayers.overlays = [new TileLayer(optionsOverlay)]
					}

					const optionsVectorLayer = {
						source: new VectorSource({
							features: []
						}),
						title: 'Session Annotations'
					}

					const vectorLayer = new VectorLayer(optionsVectorLayer)

					if (wsiImageLayers.overlays) {
						wsiImageLayers.overlays.push(vectorLayer)
					} else {
						wsiImageLayers.overlays = [vectorLayer]
					}
				}
			}

			layers.push(wsiImageLayers)
		}
		return layers
	}
}
