import type OLMap from 'ol/Map.js'
import { debounce } from 'debounce'
import { dofetch3 } from '#common/dofetch'
import VectorLayer from 'ol/layer/Vector'
import type VectorSource from 'ol/source/Vector'
import { Feature } from 'ol'
import { Polygon } from 'ol/geom'
import type { Geometry } from 'ol/geom'
import { Fill, Stroke, Style } from 'ol/style'
import type Settings from '#plots/wsiviewer/Settings.ts'
import type { Prediction, TileSelection } from '@sjcrh/proteinpaint-types'
import type { SessionWSImage } from '#plots/wsiviewer/viewModel/SessionWSImage.ts'
import type { SaveWSIAnnotationRequest } from '@sjcrh/proteinpaint-types/routes/saveWSIAnnotation.ts'
import type { DeleteWSIAnnotationRequest } from '@sjcrh/proteinpaint-types/routes/deleteWSIAnnotation.js'

export class WSIViewerInteractions {
	thumbnailClickListener: (index: number) => void
	zoomInEffectListener: (
		activeImageExtent: unknown,
		zoomInPoints: [number, number][],
		map: OLMap,
		activePatchColor: string
	) => void
	viewerClickListener: (
		coordinateX: number,
		coordinateY: number,
		sessionWSImage: SessionWSImage,
		buffers: any,
		map: OLMap
	) => void
	setKeyDownListener: (
		holder: any,
		sessionWSImage: SessionWSImage,
		map: OLMap,
		activeImageExtent: any,
		activePatchColor: string,
		aiProjectID: number,
		shortcuts?: string[],
		buffers?: any
	) => void

	constructor(wsiApp: any, opts: any) {
		this.thumbnailClickListener = (index: number) => {
			wsiApp.app.dispatch({
				type: 'plot_edit',
				id: opts.id,
				config: {
					settings: { displayedImageIndex: index, renderWSIViewer: true }
				}
			})
		}

		this.zoomInEffectListener = (
			activeImageExtent: unknown,
			zoomInPoints: [number, number][],
			map: OLMap,
			activePatchColor: string
		) => {
			const state = wsiApp.app.getState()
			const settings: Settings = state.plots.find(p => p.id === wsiApp.id).settings

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
					duration: 700
				})

				//On zooming to a new annotation, add a border around the annotation
				const vectorLayer = map
					.getLayers()
					.getArray()
					.find(l => l instanceof VectorLayer)!

				const zoomCoordinates = [zoomInPoints[0][0], imageHeight - zoomInPoints[0][1]] as [number, number]
				this.addActiveBorder(vectorLayer as VectorLayer, zoomCoordinates, activePatchColor, settings.tileSize)
			}, 200)
		}

		this.setKeyDownListener = (
			holder: any,
			sessionWSImage: SessionWSImage,
			map: OLMap,
			activeImageExtent: any,
			activePatchColor: string,
			aiProjectID: number,
			shortcuts: string[] = [],
			buffers: any
		) => {
			const state = wsiApp.app.getState()
			const settings: Settings = state.plots.find(p => p.id === wsiApp.id).settings

			// Add keydown listener to the holder
			holder.attr('tabindex', 0)
			holder.node()?.focus()

			const sessionTileSelections = sessionWSImage?.sessionsTileSelections || []
			const predictions = sessionWSImage?.predictions || []
			const annotations = sessionWSImage?.annotations || []
			const annotationsData = [...sessionTileSelections, ...predictions, ...annotations]

			holder.on('keydown', async (event: KeyboardEvent) => {
				let currentIndex = buffers.annotationsIdx.get()

				event.preventDefault()
				event.stopPropagation()
				const idx = currentIndex
				if (event.key == '.') {
					//Do not react if at the last annotation
					if (currentIndex == annotationsData.length) return
					currentIndex += 1
				}
				if (event.key == ',') {
					//Do not react if at the starting annotation
					if (currentIndex === 0) return
					currentIndex -= 1
				}

				// TODO handle this better
				const vectorLayer = map
					.getLayers()
					.getArray()
					.find(l => l instanceof VectorLayer)!

				if (event.key == 'Backspace') {
					//Delete
					this.deleteAnnotation(vectorLayer!, currentIndex)

					const body: DeleteWSIAnnotationRequest = {
						genome: state.vocab.genome,
						dslabel: state.vocab.dslabel,
						projectId: state.aiProjectID,
						annotation: annotationsData[currentIndex],
						wsimageId: sessionWSImage.id ? sessionWSImage.id : 1 //TODO: Hardcoded for dev
					}
					try {
						await dofetch3('deleteWSIAnnotation', { method: 'DELETE', body })
					} catch (e: any) {
						console.error('Error in deleteWSIAnnotation request:', e.message || e)
					}

					const nextIdx = currentIndex == annotationsData.length ? 0 : currentIndex + 1
					buffers.annotationsIdx.set(nextIdx)
					const coords = [annotationsData[nextIdx].zoomCoordinates] as unknown as [number, number][]
					this.zoomInEffectListener(activeImageExtent, coords, map, activePatchColor)
					return
				}

				if (idx !== currentIndex) {
					//When the index changes, scroll to the new annotation
					//Timeout for when user presses arrows multiple times.
					const d = debounce(async () => {
						buffers.annotationsIdx.set(currentIndex)
					}, 500)
					d()
				}

				if (shortcuts.includes(event.code)) {
					if (event.code === 'Enter' && !(annotationsData[currentIndex] as Prediction).uncertainty) {
						// in case it's not a prediction, just ignore Enter press
						return
					}

					//Update buffer to change table
					let matchingClass = sessionWSImage?.classes?.find(c => c.key_shortcut === event.code)

					if (!matchingClass) {
						matchingClass = sessionWSImage?.classes?.find(c => c.label === predictions[currentIndex].class)
					}
					const tmpClass =
						event.code === 'Enter' || matchingClass!.label == annotationsData[currentIndex].class
							? { label: 'Confirmed', color: matchingClass?.color || '' }
							: { label: matchingClass!.label, color: matchingClass!.color }
					buffers.tmpClass.set(tmpClass)

					this.addAnnotation(vectorLayer!, annotationsData, currentIndex, matchingClass!.color, settings.tileSize)

					const selectedClassId = sessionWSImage?.classes?.find(c => c.key_shortcut === event.code)?.id

					// TODO fix hardcoded userId
					const body: SaveWSIAnnotationRequest = {
						userId: 1,
						coordinates: annotationsData[currentIndex].zoomCoordinates,
						classId: selectedClassId!,
						projectId: aiProjectID,
						wsimage: sessionWSImage.filename
					}

					try {
						// TODO add UI rollback
						await dofetch3('saveWSIAnnotation', { body })
						//Advance to the next table row after annotating
						const nextIdx = currentIndex + 1
						if (nextIdx < annotationsData.length) {
							buffers.annotationsIdx.set(nextIdx)
							const coords = [annotationsData[nextIdx].zoomCoordinates] as unknown as [number, number][]
							this.zoomInEffectListener(activeImageExtent, coords, map, activePatchColor)
						}
					} catch (e) {
						console.error('Error in saveWSIAnnotation request:', e)
					}
					return
				}
			})
		}

		this.viewerClickListener = (
			coordinateX: number,
			coordinateY: number,
			sessionWSImage: SessionWSImage,
			buffers: any,
			map: OLMap
		) => {
			const state = wsiApp.app.getState()
			const settings: Settings = state.plots.find(p => p.id === wsiApp.id).settings
			const currentTileSelection = settings.sessionsTileSelection
			const predictions = sessionWSImage?.predictions || []
			const persistedAnnotationsData = sessionWSImage?.annotations || []

			const annotationsData = [...currentTileSelection, ...predictions, ...persistedAnnotationsData]

			// Check if click falls inside an existing annotation
			const selectedAnnotationIndex = annotationsData.findIndex(annotation => {
				const [x0, y0] = annotation.zoomCoordinates
				const x1 = x0 + settings.tileSize
				const y1 = y0 + settings.tileSize
				return coordinateX >= x0 && coordinateX < x1 && coordinateY >= y0 && coordinateY < y1
			})

			if (selectedAnnotationIndex !== -1) {
				buffers.annotationsIdx.set(selectedAnnotationIndex)
				return
			}

			// Create new tile section
			const newTileSelection: TileSelection = {
				zoomCoordinates: [coordinateX, coordinateY],
				class: ''
			}

			const vectorLayer = map
				.getLayers()
				.getArray()
				.find(l => l instanceof VectorLayer)!
			const source: VectorSource<Feature<Geometry>> | null = vectorLayer.getSource()

			const topLeft: [number, number] = [coordinateX, -coordinateY]
			const borderFeature = this.createBorderFeature(
				topLeft,
				settings.tileSize,
				30,
				settings.selectedPatchBorderColor,
				`prediction-border-${selectedAnnotationIndex}`
			)

			source?.addFeature(borderFeature)

			wsiApp.app.dispatch({
				type: 'plot_edit',
				id: wsiApp.id,
				config: {
					settings: {
						renderWSIViewer: false,
						sessionsTileSelection: [newTileSelection, ...currentTileSelection]
					}
				}
			})
		}
	}

	private addAnnotation(
		vectorLayer: VectorLayer,
		annotationsData: TileSelection[],
		currentIndex: number,
		color: any,
		tileSize: number
	) {
		const source: VectorSource<Feature<Geometry>> | null = vectorLayer.getSource()

		//Remove any previous feature with the same ID
		const feature = source?.getFeatureById(`annotation-square-${currentIndex}`)
		if (feature) {
			source?.removeFeature(feature)
		}

		const topLeft = [
			annotationsData[currentIndex].zoomCoordinates[0],
			-annotationsData[currentIndex].zoomCoordinates[1]
		]

		const squareCoords = [
			[
				topLeft,
				[topLeft[0] + tileSize, topLeft[1]],
				[topLeft[0] + tileSize, topLeft[1] - tileSize],
				[topLeft[0], topLeft[1] - tileSize]
			]
		]

		const square = new Feature({
			geometry: new Polygon([squareCoords[0]]),
			properties: {
				isLocked: false
			}
		})

		square.setId(`annotation-square-${currentIndex}`)

		square.setStyle(
			new Style({
				fill: new Fill({ color: color }),
				stroke: new Stroke({ color: color, width: 2 })
			})
		)

		source?.addFeature(square)
	}

	private deleteAnnotation(vectorLayer: VectorLayer, currentIndex: number) {
		const source: VectorSource<Feature<Geometry>> | null = vectorLayer.getSource()

		//Remove annotated square
		const annotationFeature = source?.getFeatureById(`annotation-square-${currentIndex}`)
		if (annotationFeature) {
			source?.removeFeature(annotationFeature)
		}
		// Remove active border
		const activeBorderFeature = source?.getFeatureById('active-border')
		if (activeBorderFeature) {
			source?.removeFeature(activeBorderFeature)
		}
		// Remove prediction border
		const predictionBorderFeature = source?.getFeatureById(`prediction-border-${currentIndex}`)
		if (predictionBorderFeature) {
			source?.removeFeature(predictionBorderFeature)
		}
		// console.log(annotationFeature, activeBorderFeature, predictionBorderFeature)
	}

	private addActiveBorder(vectorLayer: VectorLayer, zoomCoordinates: [number, number], color: any, tileSize: number) {
		const source: VectorSource<Feature<Geometry>> | null = vectorLayer.getSource()

		// Remove any previous border
		const existingFeature = source?.getFeatureById('active-border')
		if (existingFeature) {
			source?.removeFeature(existingFeature)
		}

		const feature = this.createBorderFeature(zoomCoordinates, tileSize, 50, color, 'active-border')
		source?.addFeature(feature)
	}

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
}
