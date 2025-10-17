import { dofetch3 } from '#common/dofetch'
import type { SampleWSImagesResponse, WSImage, WSImagesRequest, WSImagesResponse } from '@sjcrh/proteinpaint-types'
import { ViewModel } from '#plots/wsiviewer/viewModel/ViewModel.ts'
import type { WSImageLayers } from '#plots/wsiviewer/viewModel/WSImageLayers.ts'
import Zoomify from 'ol/source/Zoomify'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import type {
	AiProjectSelectedWSImagesRequest,
	AiProjectSelectedWSImagesResponse
} from '@sjcrh/proteinpaint-types/routes/aiProjectSelectedWSImages.ts'
import { Feature } from 'ol'
import type { Geometry } from 'ol/geom'
import { Polygon } from 'ol/geom'
import { Fill, Stroke, Style } from 'ol/style'
import type Settings from '#plots/wsiviewer/Settings.ts'
import { socket } from '#common/socket'

export class ViewModelProvider {
	constructor() {}

	async provide(
		genome: string,
		dslabel: string,
		sampleId: string,
		settings: Settings,
		aiProjectID: number | undefined = undefined,
		aiWSIMageFiles: Array<string> | undefined,
		setting: Settings,
		dom: any
	): Promise<ViewModel> {
		let wsimageLayers: Array<WSImageLayers | null> = []
		let wsimageLayersLoadError: string | undefined = undefined
		let wsImages: WSImage[] = []

		if (sampleId) {
			try {
				const data: SampleWSImagesResponse = await this.getSampleWSImages(genome, dslabel, sampleId)
				wsImages = data.sampleWSImages
				wsimageLayers = await this.getWSImageLayers(
					genome,
					dslabel,
					data.sampleWSImages,
					sampleId,
					undefined,
					settings.annotatedPatchBorderColor,
					settings.thumbnailRangeStart,
					settings.numDisplayedThumbnails,
					settings.displayedImageIndex
				)
			} catch (e: any) {
				wsimageLayersLoadError = `Error loading image layers for sample  ${sampleId}: ${e.message || e}`
			}
		} else {
			const data: AiProjectSelectedWSImagesResponse = await this.aiProjectImages(
				genome,
				dslabel,
				aiProjectID!,
				aiWSIMageFiles!,
				dom
			)
			wsImages = data.wsimages
			wsimageLayers = await this.getWSImageLayers(
				genome,
				dslabel,
				data.wsimages,
				undefined,
				aiProjectID!,
				settings.annotatedPatchBorderColor,
				settings.thumbnailRangeStart,
				settings.numDisplayedThumbnails,
				settings.displayedImageIndex
			)
		}

		return new ViewModel(wsImages, wsimageLayers, wsimageLayersLoadError, settings)
	}

	public async getSampleWSImages(genome: string, dslabel: string, sample_id: string): Promise<SampleWSImagesResponse> {
		return await dofetch3('samplewsimages', {
			body: {
				genome: genome,
				dslabel: dslabel,
				sample_id: sample_id
			}
		})
	}

	private async getWSImageLayers(
		genome: string,
		dslabel: string,
		wsimages: WSImage[],
		sampleId: string | undefined,
		aiProjectID: number | undefined,
		annotatedPatchBorderColor: string,
		thumbnailRangeStart: number,
		numDisplayedThumbnails: number,
		displayedImageIndex: number
	): Promise<Array<WSImageLayers | null>> {
		const layers: Array<WSImageLayers | null> = Array.from({ length: wsimages.length }, () => null)

		// Calculate the range of thumbnails to load
		const startIndex = thumbnailRangeStart
		const endIndex = Math.min(thumbnailRangeStart + numDisplayedThumbnails, wsimages.length)

		// Determine which indices need to be loaded
		const indicesToLoad = new Set<number>()

		// Load layers for visible thumbnail range
		for (let i = startIndex; i < endIndex; i++) {
			indicesToLoad.add(i)
		}

		// Always load the currently displayed image if not in range
		indicesToLoad.add(displayedImageIndex)

		// Load layers for the determined indices
		for (const i of indicesToLoad) {
			const wsimage = wsimages[i].filename

			const body: WSImagesRequest = {
				genome: genome,
				dslabel: dslabel,
				sampleId: sampleId,
				wsimage: wsimages[i].filename,
				aiProjectId: aiProjectID
			}

			const data: WSImagesResponse = await dofetch3('wsimages', { body })

			if (data.status === 'error') {
				throw new Error(`${data.error}`)
			}

			const imgWidth = data.slide_dimensions[0]
			const imgHeight = data.slide_dimensions[1]

			const mpp = data.mpp // microns per pixel

			let queryParams = `wsi_image=${wsimage}&dslabel=${dslabel}&genome=${genome}`
			if (sampleId) {
				queryParams += `&sample_id=${sampleId}`
			} else if (aiProjectID) {
				queryParams += `&ai_project_id=${aiProjectID}`
			}

			const zoomifyUrl = `/tileserver/layer/slide/${data.wsiSessionId}/zoomify/{TileGroup}/{z}-{x}-{y}@1x.jpg?${queryParams}`

			const source = new Zoomify({
				url: zoomifyUrl,
				size: [imgWidth, imgHeight],
				crossOrigin: 'anonymous',
				zDirection: -1
			})

			const options = {
				preview: `/tileserver/layer/slide/${data.wsiSessionId}/zoomify/TileGroup0/0-0-0@1x.jpg?${queryParams}`,
				metadata: wsimages[i].metadata,
				source: source,
				baseLayer: true,
				title: 'Slide',
				name: wsimage.replace(/(\.\w{3,4})$/i, '') //remove file extension
			}
			const layer = new TileLayer(options)

			const wsiImageLayers: WSImageLayers = {
				wsimage: layer,
				mpp: mpp
			}

			if (data.overlays) {
				for (const overlay of data.overlays) {
					let predictionQueryParams = `wsi_image=${wsimage}&dslabel=${dslabel}&genome=${genome}`
					if (sampleId) {
						predictionQueryParams += `&sample_id=${sampleId}`
					} else if (aiProjectID) {
						predictionQueryParams += `&ai_project_id=${aiProjectID}`
					}

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
						title: overlay.predictionOverlayType,
						visible: false
					}

					if (wsiImageLayers.overlays) {
						wsiImageLayers.overlays.push(new TileLayer(optionsOverlay))
					} else {
						wsiImageLayers.overlays = [new TileLayer(optionsOverlay)]
					}
				}
			}

			const annotations = wsimages[i].annotations ?? []
			const sourceAnnotations = new VectorSource()

			for (const annotation of annotations) {
				// flip Y as in your original code
				const topLeft: [number, number] = [annotation.zoomCoordinates[0], -annotation.zoomCoordinates[1]]

				const color = this.getClassColor(wsimages[i], annotation.class)
				const featureId = `annotation-square-${annotation.zoomCoordinates}`

				const squareFeature = this.createSquareFeature(topLeft, 512, color, featureId)
				sourceAnnotations.addFeature(squareFeature)

				const borderFeature = this.createBorderFeature(
					topLeft,
					512,
					15,
					annotatedPatchBorderColor,
					`annotation-border-${annotation.zoomCoordinates}`
				)
				sourceAnnotations.addFeature(borderFeature)
			}

			const vectorLayer = new VectorLayer({
				source: sourceAnnotations,
				properties: { title: 'Annotations' }
			})

			if (wsiImageLayers.overlays) {
				wsiImageLayers.overlays.push(vectorLayer)
			} else {
				wsiImageLayers.overlays = [vectorLayer]
			}

			layers[i] = wsiImageLayers
		}
		return layers
	}

	private async aiProjectImages(
		genome: string,
		dslabel: string,
		aiProjectID: number,
		aiProjectFiles: Array<string>,
		dom: any
	): Promise<AiProjectSelectedWSImagesResponse> {
		const body: AiProjectSelectedWSImagesRequest = {
			genome: genome,
			dslabel: dslabel,
			projectId: aiProjectID,
			wsimagesFilenames: aiProjectFiles
		}
		const res = await dofetch3('aiProjectSelectedWSImages', { body })
		const jobId = res.jobId
		socket.emit('subscribe-job', jobId)

		//TODO: This needs to be reusable code for other routes that use progress
		/** Also needs to be combined with the toggleLoadingDiv in the interactions*/
		return new Promise<AiProjectSelectedWSImagesResponse>((resolve, reject) => {
			const onProgress = (p: any) => {
				if (p.jobId !== jobId) return // ignore other jobs
				console.log('AI Project Selected WSI Images progress:', p)
				dom.loading.bar.attr('value', p.percent)
				dom.loading.percent.text(`${p.percent}%`)
				if (p.status === 'completed') {
					socket.off('task-progress', onProgress)
					setTimeout(() => {
						dom.loading.div.style('display', 'none')
					}, 500)
					resolve(p.data as AiProjectSelectedWSImagesResponse)
				} else if (p.status === 'error' || p.status === 'cancelled') {
					socket.off('task-progress', onProgress)
					dom.loading.div.style('display', 'none')
					reject(new Error(p.error || p.message || 'Job failed'))
				}
			}

			// avoid stacking duplicate listeners
			socket.off('task-progress', onProgress)
			socket.on('task-progress', onProgress)
		})
	}

	//TODO: This should be centralized with interaction code
	private createSquareFeature(
		topLeft: [number, number],
		tileSize: number,
		color: any,
		featureId?: string
	): Feature<Geometry> {
		const squareCoords = [
			[
				topLeft,
				[topLeft[0] + tileSize, topLeft[1]],
				[topLeft[0] + tileSize, topLeft[1] - tileSize],
				[topLeft[0], topLeft[1] - tileSize],
				topLeft
			]
		]

		const feature = new Feature({
			geometry: new Polygon(squareCoords),
			properties: {
				isLocked: false
			}
		})

		if (featureId) {
			feature.setId(featureId)
		}

		feature.setStyle(
			new Style({
				fill: new Fill({ color }),
				stroke: new Stroke({ color, width: 2 })
			})
		)

		return feature
	}

	//TODO: This should be centralized with interaction code
	private createBorderFeature(
		topLeft: [number, number],
		tileSize: number,
		borderWidth: number,
		color: any,
		featureId?: string
	): Feature<Geometry> {
		const borderCoords = [
			[
				topLeft,
				[topLeft[0] + tileSize, topLeft[1]],
				[topLeft[0] + tileSize, topLeft[1] - tileSize],
				[topLeft[0], topLeft[1] - tileSize],
				topLeft
			],
			[
				[topLeft[0] + borderWidth, topLeft[1] - borderWidth],
				[topLeft[0] + tileSize - borderWidth, topLeft[1] - borderWidth],
				[topLeft[0] + tileSize - borderWidth, topLeft[1] - tileSize + borderWidth],
				[topLeft[0] + borderWidth, topLeft[1] - tileSize + borderWidth],
				[topLeft[0] + borderWidth, topLeft[1] - borderWidth]
			]
		]

		const feature = new Feature({
			geometry: new Polygon(borderCoords),
			properties: {
				isLocked: false
			}
		})

		if (featureId) {
			feature.setId(featureId)
		}

		feature.setStyle(
			new Style({
				fill: new Fill({ color }),
				stroke: new Stroke({ color, width: 2 })
			})
		)

		return feature
	}

	private getClassColor(wsImage: WSImage, annotationClass: string): string {
		return wsImage.classes?.find(wsiCLass => String(wsiCLass.label) === annotationClass)?.color ?? '#FFFFFF' // TODO get the default color from settings
	}
}
