import type OLMap from 'ol/Map.js'
import { debounce } from 'debounce'
import { clearServerDataCache, dofetch3 } from '#common/dofetch'
import VectorLayer from 'ol/layer/Vector'
import type VectorSource from 'ol/source/Vector'
import { Feature } from 'ol'
import { Polygon } from 'ol/geom'
import type { Geometry } from 'ol/geom'
import { Fill, Stroke, Style } from 'ol/style'
import type Settings from '#plots/wsiviewer/Settings.ts'
import {
	type Annotation,
	TileSelectionImpl,
	TileSelectionPrefix,
	type Prediction,
	type TileSelection
} from '@sjcrh/proteinpaint-types'
import { SessionWSImage } from '#plots/wsiviewer/viewModel/SessionWSImage.ts'
import type { SaveWSIAnnotationRequest } from '@sjcrh/proteinpaint-types/routes/saveWSIAnnotation.ts'
import type { DeleteWSITileSelectionRequest } from '@sjcrh/proteinpaint-types/routes/deleteWSITileSelection.ts'
// import { active } from 'd3'
type UndoRedoRecord = {
	action: 'save' | 'delete'
	reaction: 'save' | 'delete'
	id: string
	class_id: number
	class_color: string
}

export class WSIViewerInteractions {
	thumbnailClickListener: (index: number) => void
	zoomInEffectListener: (
		activeImageExtent: unknown,
		zoomInPoints: [number, number][],
		map: OLMap,
		activePatchColor: string
	) => void
	viewerClickListener: (coordinateX: number, coordinateY: number, sessionWSImage: SessionWSImage, map: OLMap) => void
	setKeyDownListener: (
		holder: any,
		sessionWSImage: SessionWSImage,
		map: OLMap,
		aiProjectID: number,
		shortcuts?: string[]
	) => void
	pastActionStack: Array<UndoRedoRecord>
	futureActionStack: Array<UndoRedoRecord>
	undoStackLimit = 10
	onRetrainModelClicked: (genome: string, dslabel: string, projectId: string) => void
	toggleLoadingDiv: (show: boolean) => void
	toggleThumbnails: (start: number) => void
	fullAnnotationSave: (
		wsiApp: any,
		sessionWSImage: SessionWSImage,
		aiProjectID: number,
		tileSelections: TileSelection[],
		classColor: string,
		classID: number,
		vectorLayer: VectorLayer,
		selectedID: string
	) => Promise<void>
	savePastAction: (action: UndoRedoRecord) => void
	saveFutureAction: (action: UndoRedoRecord) => void
	constructor(wsiApp: any, opts: any) {
		this.thumbnailClickListener = (index: number) => {
			//Could be a plaece to reset undo
			wsiApp.app.dispatch({
				type: 'plot_edit',
				id: opts.id,
				config: {
					settings: {
						activeAnnotation: 0,
						activeID: '',
						sessionsTileSelection: [],
						displayedImageIndex: index,
						renderWSIViewer: true
					}
				}
			})
		}
		this.pastActionStack = []
		this.futureActionStack = []
		this.savePastAction = (action: UndoRedoRecord) => {
			if (this.pastActionStack.length < this.undoStackLimit) {
				this.pastActionStack = [...this.pastActionStack, action]
			} else {
				// If pastActionStack is too long, remove the oldest action before adding a new one
				// flexible on amount of actions we save
				this.pastActionStack = [...this.pastActionStack.slice(1), action]
			}
		}
		this.saveFutureAction = (action: UndoRedoRecord) => {
			if (this.futureActionStack.length < this.undoStackLimit) {
				this.futureActionStack = [...this.futureActionStack, action]
			} else {
				// If futureActionStack is too long, remove the oldest action before adding a new one
				// flexible on amount of actions we save
				this.futureActionStack = [...this.futureActionStack.slice(1), action]
			}
		}
		this.fullAnnotationSave = async (
			wsiApp: any,
			sessionWSImage: SessionWSImage,
			aiProjectID: number,
			tileSelections: TileSelection[],
			classColor: string,
			classID: number,
			vectorLayer: VectorLayer,
			selectedID: string
		) => {
			const state = wsiApp.app.getState()
			const settings: Settings = state.plots.find(p => p.id === wsiApp.id).settings
			if (settings.isSavingAnnotation) return
			wsiApp.app.dispatch({
				type: 'plot_edit',
				id: wsiApp.id,
				config: {
					settings: {
						isSavingAnnotation: true,
						changeTrigger: Date.now()
					}
				}
			})

			// Visual add
			this.addAnnotation(vectorLayer!, tileSelections, selectedID, classColor, settings)
			// Persist and finalize via helper
			await this.saveAndFinalizeAnnotation(wsiApp, sessionWSImage, selectedID, classID, aiProjectID)
			wsiApp.app.dispatch({
				type: 'plot_edit',
				id: wsiApp.id,
				config: {
					settings: {
						isSavingAnnotation: true,
						changeTrigger: Date.now()
					}
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

			if (!zoomInPoints || zoomInPoints.length == 0) return

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
					zoom: settings.defaultZoom,
					duration: settings.animationTime
				})

				//On zooming to a new annotation, add a border around the annotation
				const vectorLayer = map
					.getLayers()
					.getArray()
					.find(l => l instanceof VectorLayer)!

				const zoomCoordinates = [zoomInPoints[0][0], imageHeight - zoomInPoints[0][1]] as [number, number]
				this.addActiveBorder(vectorLayer as VectorLayer, zoomCoordinates, activePatchColor, settings.tileSize)
			}, settings.animationDelay)
		}

		this.setKeyDownListener = (
			holder: any,
			sessionWSImage: SessionWSImage,
			map: OLMap,
			aiProjectID: number,
			shortcuts: string[] = []
		) => {
			const state = wsiApp.app.getState()
			const settings: Settings = state.plots.find(p => p.id === wsiApp.id).settings

			// Add keydown listener to the holder
			holder.attr('tabindex', 0)
			holder.node()?.focus()

			const tileSelections = SessionWSImage.getTileSelections(sessionWSImage) || []
			holder.on('keydown', async (event: KeyboardEvent) => {
				const indexFromID = tileSelections.findIndex(tileSelection => tileSelection.id === settings.activeID)
				let currentIndex = indexFromID === -1 ? settings.activeAnnotation : indexFromID
				if (currentIndex === -1) {
					currentIndex = 0
				}

				event.preventDefault()
				event.stopPropagation()
				const idx = currentIndex
				if (event.key == '.') {
					//Do not react if at the last annotation
					if (currentIndex == tileSelections.length) return
					currentIndex += 1
				}
				if (event.key == ',') {
					//Do not react if at the starting annotation
					if (currentIndex === 0) return
					currentIndex -= 1
				}

				if (idx !== currentIndex) {
					//When the index changes, scroll to the new annotation
					//Timeout for when user presses arrows multiple times.
					const d = debounce(async () => {
						wsiApp.app.dispatch({
							type: 'plot_edit',
							id: wsiApp.id,
							config: {
								settings: {
									renderWSIViewer: false,
									activeAnnotation: currentIndex,
									activeID: tileSelections[currentIndex]?.id ?? ''
								}
							}
						})
					}, 500)
					d()
				}

				// TODO handle this better
				const vectorLayer = map
					.getLayers()
					.getArray()
					.find(l => l instanceof VectorLayer)!

				// New Enter key branch: check for prediction uncertainty and save annotation
				if (event.key === 'Enter') {
					// Only proceed if this selection has a prediction uncertainty
					if (!(tileSelections[currentIndex] as Prediction).uncertainty) {
						return
					}

					const predictions = sessionWSImage?.predictions
					if (!predictions || !predictions[currentIndex]) return

					// Find class by prediction label
					const matchingClass = sessionWSImage?.classes?.find(c => c.label === predictions[currentIndex].class)

					if (!matchingClass) {
						// Nothing to annotate against
						return
					}

					// Draw annotation visually
					await this.fullAnnotationSave(
						wsiApp,
						sessionWSImage,
						aiProjectID,
						tileSelections,
						matchingClass.color,
						matchingClass.id,
						vectorLayer!,
						tileSelections[currentIndex].id
					)

					return
				}
				if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
					// call your undo handler here
					let lastAction: UndoRedoRecord | undefined
					if (!event.shiftKey) {
						lastAction = this.pastActionStack.pop()
					} else {
						lastAction = this.futureActionStack.pop()
					}

					if (lastAction) {
						if (lastAction.reaction === 'save') {
							await this.fullAnnotationSave(
								wsiApp,
								sessionWSImage,
								aiProjectID,
								tileSelections,
								lastAction.class_color,
								lastAction.class_id,
								vectorLayer!,
								lastAction.id
							)
						} else if (lastAction.reaction === 'delete') {
							await this.deleteAnnotation(wsiApp, vectorLayer!, sessionWSImage, lastAction.id)
						}
						if (event.shiftKey) {
							this.savePastAction({ ...lastAction, action: lastAction.reaction, reaction: lastAction.action })
						} else {
							this.saveFutureAction({ ...lastAction, action: lastAction.reaction, reaction: lastAction.action })
						}
					}
					return
				}
				if (event.key == 'Backspace') {
					//Delete
					//Dispatching inverse action for undo, i.e. if we delete a tile we add a function
					//to be popped of the pastActionStack that would re-add the tile.
					const tileSelection = tileSelections.find(t => t.id === settings.activeID) as Annotation
					const matchingClass = sessionWSImage?.classes?.find(c => c.key_shortcut === tileSelection?.class)
					if (!matchingClass) {
						console.log('shit')
						return
					}
					this.savePastAction({
						action: 'delete',
						id: settings.activeID,
						reaction: 'save',
						class_color: matchingClass.color,
						class_id: matchingClass.id
					})
					await this.deleteAnnotation(wsiApp, vectorLayer!, sessionWSImage, settings.activeID)
					// Might want to only save inverse if forward is successful
				}

				if (shortcuts.includes(event.code)) {
					const tileSelection = tileSelections[currentIndex]
					// Resolve class either by key_shortcut
					const matchingClass = sessionWSImage?.classes?.find(c => c.key_shortcut === event.code)
					if (!matchingClass) return
					console.log(matchingClass)
					this.savePastAction({
						action: 'save',
						reaction: 'delete',
						id: tileSelection.id,
						class_color: matchingClass.color,
						class_id: matchingClass.id
					})

					await this.fullAnnotationSave(
						wsiApp,
						sessionWSImage,
						aiProjectID,
						tileSelections,
						matchingClass.color,
						matchingClass.id,
						vectorLayer!,
						tileSelection.id
					)

					// Might want to only save inverse if forward is successful
					// move thsi dispatch to fullAnnotation
					wsiApp.app.dispatch({
						type: 'plot_edit',
						id: wsiApp.id,
						config: {
							settings: {
								isSavingAnnotation: false,
								changeTrigger: Date.now()
							}
						}
					})
					return
				}
			})
		}

		this.viewerClickListener = (
			coordinateX: number,
			coordinateY: number,
			sessionWSImage: SessionWSImage,
			map: OLMap
		) => {
			const state = wsiApp.app.getState()
			const settings: Settings = state.plots.find(p => p.id === wsiApp.id).settings
			const sessionsTileSelection = settings.sessionsTileSelection

			sessionWSImage.sessionsTileSelections = sessionsTileSelection

			const tileSelections = SessionWSImage.getTileSelections(sessionWSImage)
			// Check if click falls inside an existing annotation
			const selectedTileSelectionIndex = tileSelections.findIndex(tileSelection => {
				const [x0, y0] = tileSelection.zoomCoordinates
				const x1 = x0 + settings.tileSize
				const y1 = y0 + settings.tileSize
				return coordinateX >= x0 && coordinateX < x1 && coordinateY >= y0 && coordinateY < y1
			})

			if (selectedTileSelectionIndex !== -1) {
				wsiApp.app.dispatch({
					type: 'plot_edit',
					id: wsiApp.id,
					config: {
						settings: {
							renderWSIViewer: false,
							renderAnnotationTable: true,
							changeTrigger: Date.now(),
							activeAnnotation: selectedTileSelectionIndex,
							activeID: tileSelections[selectedTileSelectionIndex].id,
							sessionsTileSelection: [...sessionsTileSelection]
						}
					}
				})
				return
			}

			// Create new tile section
			const newTileSelection: TileSelection = new TileSelectionImpl([coordinateX, coordinateY], '')

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
				`prediction-border-${newTileSelection.zoomCoordinates}`
			)
			//Add border feature

			source?.addFeature(borderFeature)

			wsiApp.app.dispatch({
				type: 'plot_edit',
				id: wsiApp.id,
				config: {
					settings: {
						renderWSIViewer: false,
						renderAnnotationTable: true,
						activeAnnotation: 0,
						activeID: newTileSelection.id,
						changeTrigger: Date.now(),
						sessionsTileSelection: [newTileSelection, ...sessionsTileSelection]
					}
				}
			})
		}

		this.onRetrainModelClicked = async (genome: string, dslabel: string, projectId: string) => {
			try {
				await dofetch3('/aiProjectTrainModel', {
					body: {
						genome,
						dslabel,
						projectId
					}
				})
				clearServerDataCache()

				wsiApp.app.dispatch({
					type: 'plot_edit',
					id: opts.id,
					config: {
						settings: {
							renderWSIViewer: true,
							renderAnnotationTable: true,
							changeTrigger: Date.now()
						}
					}
				})
			} catch (e: any) {
				this.toggleLoadingDiv(false)
				wsiApp.app.printError('Error retraining model: ' + (e.message || e))
			}
		}

		this.toggleLoadingDiv = (show: boolean) => {
			if (show) {
				wsiApp.dom.loadingDiv.selectAll('*').remove()
				wsiApp.dom.loadingDiv
					.style('display', 'block')
					.append('div')
					.style('position', 'relative')
					.style('top', '50%')
					.append('span')
					.attr('class', 'sjpp-spinner')

				wsiApp.dom.mapHolder.style('display', 'none')
				wsiApp.dom.annotationsHolder.style('display', 'none')
				wsiApp.dom.legendHolder.style('display', 'none')
			} else {
				wsiApp.dom.loadingDiv.style('display', 'none')
				wsiApp.dom.mapHolder.style('display', 'block')
				wsiApp.dom.annotationsHolder.style('display', 'inline-block')
				wsiApp.dom.legendHolder.style('display', 'inline-block')
			}
		}

		this.toggleThumbnails = (start: number) => {
			wsiApp.app.dispatch({
				type: 'plot_edit',
				id: opts.id,
				config: {
					settings: { thumbnailRangeStart: start, displayedImageIndex: start, renderWSIViewer: true }
				}
			})
		}
	}
	performUndo() {
		throw new Error('Method not implemented.')
	}

	private addAnnotation(
		vectorLayer: VectorLayer,
		tileSelections: TileSelection[],
		selectedId: string,
		color: any,
		settings: Settings
	) {
		const source: VectorSource<Feature<Geometry>> | null = vectorLayer.getSource()
		const tileSelection = tileSelections.find(ts => ts.id === selectedId)
		if (!tileSelection) return
		//Remove any previous feature with the same ID
		const feature = source?.getFeatureById(`annotation-square-${tileSelection.zoomCoordinates}`)
		if (feature) {
			source?.removeFeature(feature)
		}

		const topLeft: [number, number] = [tileSelection.zoomCoordinates[0], -tileSelection.zoomCoordinates[1]]

		const squareCoords = [
			[
				topLeft,
				[topLeft[0] + settings.tileSize, topLeft[1]],
				[topLeft[0] + settings.tileSize, topLeft[1] - settings.tileSize],
				[topLeft[0], topLeft[1] - settings.tileSize]
			]
		]

		const square = new Feature({
			geometry: new Polygon([squareCoords[0]]),
			properties: {
				isLocked: false
			}
		})

		square.setId(`annotation-square-${tileSelection.zoomCoordinates}`)

		square.setStyle(
			new Style({
				fill: new Fill({ color: color }),
				stroke: new Stroke({ color: color, width: 2 })
			})
		)

		source?.addFeature(square)

		this.addAnnotationBorder(
			source,
			topLeft,
			tileSelection.zoomCoordinates,
			settings.annotatedPatchBorderColor,
			settings.tileSize
		)
	}

	private async deleteAnnotation(
		wsiApp: any,
		vectorLayer: VectorLayer<any, any>,
		sessionWSImage: SessionWSImage,
		selectedId: string
	) {
		const state = wsiApp.app.getState()
		let deleteSuccess = false
		const tileSelections: TileSelection[] = SessionWSImage.getTileSelections(sessionWSImage)
		const tileSelection = tileSelections.find(ts => ts.id === selectedId)
		if (!tileSelection) return
		const source: VectorSource<Feature<Geometry>> | null = vectorLayer.getSource()

		//Remove annotated square
		const annotationFeature = source?.getFeatureById(`annotation-square-${tileSelection.zoomCoordinates}`)
		if (annotationFeature) {
			source?.removeFeature(annotationFeature)
		}
		// Remove active border
		const activeBorderFeature = source?.getFeatureById('active-border')
		if (activeBorderFeature) {
			source?.removeFeature(activeBorderFeature)
		}
		// Remove prediction border
		const predictionBorderFeature = source?.getFeatureById(`prediction-border-${tileSelection.zoomCoordinates}`)
		if (predictionBorderFeature) {
			source?.removeFeature(predictionBorderFeature)
		}

		// Remove annotation border
		const annotationBorderFeat = source?.getFeatureById(`annotation-border-${tileSelection.zoomCoordinates}`)
		if (annotationBorderFeat) {
			source?.removeFeature(annotationBorderFeat)
		}

		if (SessionWSImage.isSessionTileSelection(selectedId, sessionWSImage)) {
			const sessionsTileSelection = SessionWSImage.removeTileSelection(selectedId, sessionWSImage)

			wsiApp.app.dispatch({
				type: 'plot_edit',
				id: wsiApp.id,
				config: {
					settings: {
						renderWSIViewer: false,
						renderAnnotationTable: true,
						activeAnnotation: 0,
						activeID: tileSelections[0]?.id ?? '',
						changeTrigger: Date.now(),
						sessionsTileSelection: sessionsTileSelection
					}
				}
			})
			return
		}

		const isPrediction = SessionWSImage.isPrediction(selectedId, sessionWSImage)

		const tileSelectionType = isPrediction ? 0 : 1

		const prediction = tileSelections.find(ts => ts.id === selectedId) as Prediction

		const body: DeleteWSITileSelectionRequest = {
			genome: state.vocab.genome,
			dslabel: state.vocab.dslabel,
			projectId: state.aiProjectID,
			tileSelection: tileSelection,
			predictionClassId: prediction.class,
			tileSelectionType: tileSelectionType,
			wsimage: sessionWSImage.filename
		}

		try {
			await dofetch3('deleteWSITileSelection', { method: 'DELETE', body })
			deleteSuccess = true
		} catch (e: any) {
			console.error('Error in deleteWSITileSelection request:', e.message || e)
		}
		// TODO find another way to clear server cache
		clearServerDataCache()

		const sessionsTileSelection: TileSelection[] = sessionWSImage.sessionsTileSelections ?? []
		wsiApp.app.dispatch({
			type: 'plot_edit',
			id: wsiApp.id,
			config: {
				settings: {
					renderWSIViewer: false,
					renderAnnotationTable: true,
					activeAnnotation: 0,
					activeID: tileSelections[0]?.id ?? '',
					changeTrigger: Date.now(),
					sessionsTileSelection: sessionsTileSelection
				}
			}
		})
		return deleteSuccess
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

	private addAnnotationBorder(source, topLeft, zoomCoordinates: [number, number], color: string, tileSize: number) {
		const existingFeature = source?.getFeatureById(`prediction-border-${zoomCoordinates}`)
		if (existingFeature) {
			source?.removeFeature(existingFeature)
		}
		const annotatedBorderFeat = this.createBorderFeature(
			topLeft,
			tileSize,
			15,
			color,
			`annotation-border-${zoomCoordinates}`
		)
		source?.addFeature(annotatedBorderFeat)
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

	private async saveAndFinalizeAnnotation(
		wsiApp: any,
		sessionWSImage: SessionWSImage,
		selectedId: string,
		selectedClassId: number | undefined,
		aiProjectID: number
	) {
		const state = wsiApp.app.getState()
		const tileSelections: TileSelection[] = SessionWSImage.getTileSelections(sessionWSImage)
		let saveSuccess = false
		const body: SaveWSIAnnotationRequest = {
			genome: state.vocab.genome,
			dslabel: state.vocab.dslabel,
			coordinates: tileSelections.find(ts => ts.id === selectedId)!.zoomCoordinates,
			classId: selectedClassId!,
			projectId: aiProjectID,
			wsimage: sessionWSImage.filename
		}

		try {
			// TODO add UI rollback
			await dofetch3('saveWSIAnnotation', { method: 'POST', body })
			saveSuccess = true
			// TODO find another way to clear server cache
			clearServerDataCache()
		} catch (e) {
			console.error('Error in saveWSIAnnotation request:', e)
		}
		console.log(selectedId, selectedId.replace(TileSelectionPrefix.ANNOTATION, TileSelectionPrefix.PREDICTION))
		SessionWSImage.removeTileSelection(selectedId, sessionWSImage)
		const sessionsTileSelection: TileSelection[] = sessionWSImage.sessionsTileSelections ?? []
		wsiApp.app.dispatch({
			type: 'plot_edit',
			id: wsiApp.id,
			config: {
				settings: {
					renderWSIViewer: false,
					changeTrigger: Date.now(),
					activeAnnotation: 0,
					activeID: tileSelections[0]?.id ?? '',
					sessionsTileSelection: sessionsTileSelection
				}
			}
		})
		return saveSuccess
	}
}
