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
	FlagStatus,
	createSelectionID,
	SelectionPrefixes,
	FeaturePrefixes,
	checkSelectionType,
	createFeatureID,
	type FlagStatusValues
} from '#types'
import type { SaveWSIAnnotationRequest, DeleteWSITileSelectionRequest, TileSelection } from '#types'
import { SessionWSImage } from '#plots/wsiviewer/viewModel/SessionWSImage.ts'
import { createDimSquareFeature, createStarFeature } from '#plots/wsiviewer/viewModel/ViewModelProvider.ts'
import { DownloadCSVButtonRenderer } from '../view/DownloadCSVButtonRenderer'
import {
	UndoRedoHistory,
	SessionSkipFlagCommand,
	AnnotationFlagCommand,
	SaveTileCommand,
	DeleteSessionTileCommand,
	DeleteAnnotationCommand,
	type UndoRedoContext,
	CreateTileCommand
} from '#plots/wsiviewer/interactions/UndoRedoHistory.ts'

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
		shortcuts?: string[],
		downloadCSVRenderer?: DownloadCSVButtonRenderer
	) => void

	onRetrainModelClicked: (genome: string, dslabel: string, projectId: string) => void
	toggleLoadingDiv: (show: boolean) => void
	toggleThumbnails: (start: number) => void
	fullSave: (
		sessionWSImage: SessionWSImage,
		eventCode: string,
		settings: Settings,
		vectorLayer: VectorLayer<any, any>,
		tileSelection: TileSelection,
		aiProjectID: number,
		nextID?: string
	) => Promise<SaveTileCommand | undefined>
	fullDelete: (
		wsiApp: any,
		vectorLayer: VectorLayer<any, any>,
		sessionWSImage: SessionWSImage,
		currentID: string,
		nextID?: string
	) => Promise<DeleteSessionTileCommand | DeleteAnnotationCommand | undefined>
	readonly undoRedoHistory = new UndoRedoHistory()

	constructor(wsiApp: any, opts: any) {
		this.fullDelete = async (
			wsiApp: any,
			vectorLayer: VectorLayer<any, any>,
			sessionWSImage: SessionWSImage,
			currentID: string,
			nextID: string = ''
		): Promise<DeleteSessionTileCommand | DeleteAnnotationCommand | undefined> => {
			const tileToDelete = SessionWSImage.getUnfilteredTileSelections(sessionWSImage).find(ts => ts.id === currentID)
			if (tileToDelete === undefined) {
				console.error(`fullDelete could not find id ${currentID} in tileSelections`)
				return
			}
			const classID: number | undefined = sessionWSImage?.classes?.find(c => c.label === tileToDelete.class)?.id
			const wasSessionTile = SessionWSImage.isSessionTileSelection(tileToDelete, sessionWSImage)
			const prevSessionsTileSelections = (sessionWSImage.sessionsTileSelections ?? []).map(ts => ({ ...ts }))
			const delSource = vectorLayer!.getSource()
			const capturedFeatures = [
				createFeatureID(FeaturePrefixes.PredBorder, tileToDelete.zoomCoordinates),
				createFeatureID(FeaturePrefixes.Square, tileToDelete.zoomCoordinates),
				createFeatureID(FeaturePrefixes.Border, tileToDelete.zoomCoordinates),
				createFeatureID(FeaturePrefixes.Star, tileToDelete.zoomCoordinates)
			]
				.map(id => delSource?.getFeatureById(id))
				.filter((f): f is Feature<Geometry> => f != null)

			await this.deleteAnnotation(wsiApp, vectorLayer!, sessionWSImage, currentID, classID, nextID)

			if (wasSessionTile) {
				return new DeleteSessionTileCommand({
					tileSelection: { ...tileToDelete },
					prevSessionsTileSelections,
					capturedFeatures
				})
			} else if (classID !== undefined) {
				return new DeleteAnnotationCommand({
					tileSelection: { ...tileToDelete },
					classId: classID,
					prevSessionsTileSelections
				})
			}
		}

		this.fullSave = async (
			sessionWSImage: SessionWSImage,
			eventCode: string,
			settings: Settings,
			vectorLayer: VectorLayer<any, any>,
			tileSelection: TileSelection,
			aiProjectID: number,
			nextID: string = ''
		): Promise<SaveTileCommand | undefined> => {
			const matchingClass = sessionWSImage?.classes?.find(c => c.key_shortcut === eventCode)
			if (!matchingClass) return
			const currentIndex = SessionWSImage.getTileSelections(
				sessionWSImage,
				settings.renderSkipped,
				settings.renderOnlyFlagged
			).findIndex(ts => ts.id === tileSelection.id)
			if (currentIndex === -1) {
				console.error(`fullSave could not find id ${tileSelection.id} in tileSelections`)
				return
			}
			if (nextID === '') {
				nextID = SessionWSImage.getNextTileID(
					sessionWSImage,
					settings.renderSkipped,
					settings.renderOnlyFlagged,
					currentIndex
				)
			}
			// TODO: Issue where if you press shortcuts too fast, annotation table doesnt get updated with correct class
			//My guess is that if you press this fast enough, saveAnnotation doesnt update fast enough
			wsiApp.app.dispatch({
				type: 'plot_edit',
				id: wsiApp.id,
				config: {
					settings: {
						isSavingAnnotation: true,
						changeTrigger: Date.now(),
						renderWSIViewer: false
					}
				}
			})
			// Visual add
			this.addAnnotation(vectorLayer!, tileSelection, matchingClass.color, settings)

			const selectedClassId = matchingClass.id
			const prevTileSelection = { ...tileSelection }
			const prevSessionsTileSelections = (sessionWSImage.sessionsTileSelections ?? []).map(ts => ({ ...ts }))
			tileSelection.id = createSelectionID(SelectionPrefixes.Annotation, tileSelection.zoomCoordinates)
			tileSelection.flag = FlagStatus.Normal
			tileSelection.class = matchingClass.label
			const source: VectorSource<Feature<Geometry>> | null = vectorLayer.getSource()
			const oldStar = source?.getFeatureById(createFeatureID(FeaturePrefixes.Star, tileSelection.zoomCoordinates))
			if (oldStar) {
				source?.removeFeature(oldStar)
			}

			// Persist and finalize via helper
			await this.saveAndFinalizeAnnotation(wsiApp, sessionWSImage, tileSelection, selectedClassId, aiProjectID, nextID)

			return new SaveTileCommand(
				{
					postTileSelection: { ...tileSelection },
					prevTileSelection: prevTileSelection,
					prevSessionsTileSelections: prevSessionsTileSelections,
					classId: selectedClassId,
					eventCode: eventCode
				},
				settings
			)
		}

		this.thumbnailClickListener = (index: number) => {
			this.undoRedoHistory.clear()
			wsiApp.app.dispatch({
				type: 'plot_edit',
				id: opts.id,
				config: {
					settings: {
						activeAnnotation: 0,
						sessionsTileSelection: [],
						displayedImageIndex: index,
						renderWSIViewer: true
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
			shortcuts: string[] = [],
			downloadCSVRenderer: DownloadCSVButtonRenderer = new DownloadCSVButtonRenderer()
		) => {
			const state = wsiApp.app.getState()
			const settings: Settings = state.plots.find(p => p.id === wsiApp.id).settings

			// Add keydown listener to the holder
			holder.attr('tabindex', 0)
			holder.node()?.focus()

			const tileSelections =
				SessionWSImage.getTileSelections(sessionWSImage, settings.renderSkipped, settings.renderOnlyFlagged) || []

			holder.on('keydown', async (event: KeyboardEvent) => {
				let currentIndex = settings.activeAnnotation

				event.preventDefault()
				event.stopPropagation()

				if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
					if (settings.isSavingAnnotation) return
					const freshState = wsiApp.app.getState()
					const undoCtx: UndoRedoContext = {
						wsiApp,
						wsiInteractions: this,
						sessionImage: sessionWSImage,
						vectorLayer: map
							.getLayers()
							.getArray()
							.find(l => l instanceof VectorLayer) as VectorLayer<any, any>,
						serverCtx: {
							genome: freshState.vocab.genome,
							dslabel: freshState.vocab.dslabel,
							projectId: freshState.aiProjectID,
							wsimage: sessionWSImage.filename
						}
					}
					if (event.shiftKey) {
						await this.undoRedoHistory.redo(undoCtx)
					} else {
						console.log('Undo triggered')
						await this.undoRedoHistory.undo(undoCtx)
					}
					return
				}

				const idx = currentIndex
				if (event.key == '.') {
					//Do not react if at the last annotation
					if (currentIndex == tileSelections.length) {
						currentIndex = 0
					} else {
						currentIndex += 1
					}
				}

				if (event.key == ',') {
					//Do not react if at the starting annotation
					if (currentIndex === 0) {
						// If at the starting tileselection, find the the most recent Annotation by checking for timestamp property
						currentIndex = tileSelections.findIndex(
							ts => checkSelectionType(ts, SelectionPrefixes.Annotation) || ts.flag !== FlagStatus.Normal
						)
						if (currentIndex === -1) {
							currentIndex = 0
						}
					} else {
						currentIndex -= 1
					}
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
									activeAnnotation: currentIndex
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

				if (event.key == 'Backspace') {
					const deleteCommand = await this.fullDelete(
						wsiApp,
						vectorLayer,
						sessionWSImage,
						tileSelections[currentIndex].id
					)
					if (deleteCommand) {
						this.undoRedoHistory.push(deleteCommand)
					}
				}

				if (event.key.toLowerCase() === 'r') {
					this.toggleLoadingDiv(true)
					await this.onRetrainModelClicked(
						state.genome || state.vocab.genome,
						state.dslabel || state.vocab.dslabel,
						state.aiProjectID
					)
				}

				if (event.key.toLowerCase() === 'x') {
					if (!sessionWSImage) return
					downloadCSVRenderer.downloadAllAsCsv(sessionWSImage)
				}

				if (['f', 's'].includes(event.key.toLowerCase()) && !settings.isSavingAnnotation) {
					wsiApp.app.dispatch({
						type: 'plot_edit',
						id: wsiApp.id,
						config: {
							settings: {
								isSavingAnnotation: true,
								changeTrigger: Date.now(),
								renderWSIViewer: false
							}
						}
					})
					try {
						const defaultColor = 'black'
						const tileSelection = tileSelections[currentIndex]
						const isAnnotation = checkSelectionType(tileSelection, SelectionPrefixes.Annotation)
						const justTileSelection = checkSelectionType(tileSelection, SelectionPrefixes.TileSelection)
						const matchingClass = sessionWSImage?.classes?.find(c => c.label === tileSelection.class)
						const classColor: string = matchingClass ? matchingClass.color : defaultColor
						let newFlag: FlagStatusValues | null = null
						const nextID = SessionWSImage.getNextTileID(
							sessionWSImage,
							settings.renderSkipped,
							settings.renderOnlyFlagged,
							currentIndex
						)
						if (event.key.toLowerCase() === 'f') {
							newFlag = tileSelection.flag === FlagStatus.Flagged ? FlagStatus.Normal : FlagStatus.Flagged
						} else if (!justTileSelection && event.key.toLowerCase() === 's') {
							newFlag = tileSelection.flag === FlagStatus.Skipped ? FlagStatus.Normal : FlagStatus.Skipped
						}
						if (newFlag === null) throw new Error("Couldn't identify new flag to save.")

						const source: VectorSource<Feature<Geometry>> | null = vectorLayer.getSource()
						const tileSelectionBefore = { ...tileSelection }
						const prevSessionsTileSelections = (sessionWSImage.sessionsTileSelections ?? []).map(ts => ({ ...ts }))
						const flagFeatureIds = [
							createFeatureID(FeaturePrefixes.Star, tileSelection.zoomCoordinates),
							createFeatureID(FeaturePrefixes.Square, tileSelection.zoomCoordinates),
							createFeatureID(FeaturePrefixes.Border, tileSelection.zoomCoordinates),
							createFeatureID(FeaturePrefixes.PredBorder, tileSelection.zoomCoordinates)
						]
						const preActionFeatures = flagFeatureIds
							.map(id => source?.getFeatureById(id))
							.filter((f): f is Feature<Geometry> => f != null)
						tileSelection.flag = newFlag

						this.removeFeaturesByIds(source!, flagFeatureIds)

						if (newFlag === FlagStatus.Flagged) {
							const newStar = createStarFeature(
								settings.tileSize || 512,
								[tileSelection.zoomCoordinates[0], -tileSelection.zoomCoordinates[1]],
								tileSelection.zoomCoordinates,
								'yellow',
								classColor
							)
							this.addAnnotation(vectorLayer!, tileSelection, classColor, settings)
							source?.addFeature(newStar)
						} else if (newFlag === FlagStatus.Skipped) {
							const newDim = createDimSquareFeature(
								tileSelection.zoomCoordinates,
								[tileSelection.zoomCoordinates[0], -tileSelection.zoomCoordinates[1]],
								settings.tileSize || 512,
								classColor
							)
							source?.addFeature(newDim)
						} else if (isAnnotation) {
							this.addAnnotation(vectorLayer!, tileSelection, classColor, settings)
						}
						const postActionFeatures = flagFeatureIds
							.map(id => source?.getFeatureById(id))
							.filter((f): f is Feature<Geometry> => f != null)
						if (justTileSelection) {
							SessionWSImage.removeTileSelection(tileSelection, sessionWSImage)
							tileSelection.timestamp = new Date().toISOString()
							let sessionsTileSelection: TileSelection[] = sessionWSImage.sessionsTileSelections ?? []
							sessionsTileSelection = [tileSelection, ...sessionsTileSelection]
							wsiApp.app.dispatch({
								type: 'plot_edit',
								id: wsiApp.id,
								config: {
									settings: {
										renderWSIViewer: false,
										changeTrigger: Date.now(),
										activeAnnotation: 0,
										activeID: nextID,
										renderAnnotationTable: true,
										sessionsTileSelection: sessionsTileSelection,
										isSavingAnnotation: false
									}
								}
							})
							this.undoRedoHistory.push(
								new SessionSkipFlagCommand({
									preActionFeatures,
									postActionFeatures,
									prevSessionsTileSelections,
									newSessionsTileSelections: sessionsTileSelection.map(ts => ({ ...ts }))
								})
							)
							return
						} else if (matchingClass) {
							await this.saveAndFinalizeAnnotation(
								wsiApp,
								sessionWSImage,
								tileSelection,
								matchingClass.id,
								aiProjectID,
								nextID
							)
							this.undoRedoHistory.push(
								new AnnotationFlagCommand({
									tileSelectionBefore,
									tileSelectionAfter: { ...tileSelection },
									classId: matchingClass.id,
									sessionsTileSelections: [...settings.sessionsTileSelection]
								})
							)
						}
					} catch (error: any) {
						console.trace("Couldn't successfully flag tile:", error)
					}

					wsiApp.app.dispatch({
						type: 'plot_edit',
						id: wsiApp.id,
						config: {
							settings: {
								isSavingAnnotation: false,
								changeTrigger: Date.now(),
								renderWSIViewer: false
							}
						}
					})
					return
				}

				// New Enter key branch: check for prediction uncertainty and save annotation
				if (event.key === 'Enter') {
					// Only proceed if this selection has a prediction uncertainty
					const tileSelection = tileSelections[currentIndex]
					if (!checkSelectionType(tileSelection, SelectionPrefixes.Prediction)) {
						return
					}
					const predictions = sessionWSImage?.predictions
					if (!predictions || !predictions[currentIndex]) return
					const saveCommand = await this.fullSave(
						sessionWSImage,
						event.code,
						settings,
						vectorLayer!,
						tileSelection,
						aiProjectID
					)
					if (saveCommand) {
						this.undoRedoHistory.push(saveCommand)
					}
				}
				if (shortcuts.includes(event.code) && !settings.isSavingAnnotation) {
					// Resolve class either by key_shortcut
					const tileSelection = tileSelections[currentIndex]
					const saveCommand = await this.fullSave(
						sessionWSImage,
						event.code,
						settings,
						vectorLayer!,
						tileSelection,
						aiProjectID
					)
					if (saveCommand) {
						this.undoRedoHistory.push(saveCommand)
					}
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

			const tileSelections = SessionWSImage.getUnfilteredTileSelections(sessionWSImage)

			// Check if click falls inside an existing annotation
			const selectedTileSelection = tileSelections.find(tileSelection => {
				const [x0, y0] = tileSelection.zoomCoordinates
				const x1 = x0 + settings.tileSize
				const y1 = y0 + settings.tileSize
				return coordinateX >= x0 && coordinateX < x1 && coordinateY >= y0 && coordinateY < y1
			})
			// Need to have solution for clicking on skipped tiles. Maybe show skipped or just dont move and show warning
			if (selectedTileSelection !== undefined) {
				const isSkipped = selectedTileSelection.flag === FlagStatus.Skipped
				const isFlagged = selectedTileSelection.flag === FlagStatus.Flagged
				if (isSkipped && !settings.renderSkipped) {
					wsiApp.app.dispatch({
						type: 'plot_edit',
						id: wsiApp.id,
						config: {
							settings: {
								renderWSIViewer: false,
								renderAnnotationTable: true,
								renderSkipped: true,
								renderOnlyFlagged: false,
								changeTrigger: Date.now(),
								activeAnnotation: 0,
								activeID: selectedTileSelection.id,
								sessionsTileSelection: [...sessionsTileSelection]
							}
						}
					})
				} else if (!isFlagged && settings.renderOnlyFlagged) {
					wsiApp.app.dispatch({
						type: 'plot_edit',
						id: wsiApp.id,
						config: {
							settings: {
								renderWSIViewer: false,
								renderAnnotationTable: true,
								renderOnlyFlagged: false,
								changeTrigger: Date.now(),
								activeAnnotation: 0,
								activeID: selectedTileSelection.id,
								sessionsTileSelection: [...sessionsTileSelection]
							}
						}
					})
				} else {
					wsiApp.app.dispatch({
						type: 'plot_edit',
						id: wsiApp.id,
						config: {
							settings: {
								renderWSIViewer: false,
								renderAnnotationTable: true,
								changeTrigger: Date.now(),
								activeAnnotation: 0,
								activeID: selectedTileSelection.id,
								sessionsTileSelection: [...sessionsTileSelection]
							}
						}
					})
				}

				return
			}

			// Create new tile section
			const newTileSelection: TileSelection = {
				zoomCoordinates: [coordinateX, coordinateY],
				class: '',
				flag: FlagStatus.Normal,
				id: createSelectionID(SelectionPrefixes.TileSelection, [coordinateX, coordinateY]),
				timestamp: new Date().toISOString()
			}
			const vectorLayer = map
				.getLayers()
				.getArray()
				.find(l => l instanceof VectorLayer)
			const borderFeature = this.addTileSelection(
				wsiApp,
				newTileSelection,
				vectorLayer!,
				settings.selectedPatchBorderColor,
				[newTileSelection, ...sessionsTileSelection],
				settings.tileSize
			)
			if (!borderFeature) {
				console.error('Could not find border feature after adding tile selection')
				return
			}

			this.undoRedoHistory.push(new CreateTileCommand(borderFeature, newTileSelection, [...sessionsTileSelection]))
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
	public addTileSelection(
		wsiApp: any,
		tileSelection: TileSelection,
		vectorLayer: VectorLayer<any, any>,
		borderColor: string,
		newSessionsTileSelections: TileSelection[],
		tileSize: number = 512
	): Feature<Geometry> | null {
		const source: VectorSource<Feature<Geometry>> | null = vectorLayer.getSource()

		const topLeft: [number, number] = [tileSelection.zoomCoordinates[0], -tileSelection.zoomCoordinates[1]]
		const borderFeature = this.createBorderFeature(
			topLeft,
			tileSize,
			30,
			borderColor,
			createFeatureID(FeaturePrefixes.PredBorder, tileSelection.zoomCoordinates)
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
					changeTrigger: Date.now(),
					sessionsTileSelection: [...newSessionsTileSelections]
				}
			}
		})
		return borderFeature
	}
	private removeFeaturesByIds(source: VectorSource<Feature<Geometry>>, featureIds: string[]) {
		for (const id of featureIds) {
			const feature = source.getFeatureById(id)
			if (feature) {
				source.removeFeature(feature)
			}
		}
	}

	private addAnnotation(vectorLayer: VectorLayer, tileSelection: TileSelection, color: any, settings: Settings) {
		const source: VectorSource<Feature<Geometry>> | null = vectorLayer.getSource()
		//Remove any previous feature with the same ID
		const feature = source?.getFeatureById(createFeatureID(FeaturePrefixes.Square, tileSelection.zoomCoordinates))
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

		square.setId(createFeatureID(FeaturePrefixes.Square, tileSelection.zoomCoordinates))

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
		currentId: string,
		classID: number | undefined,
		nextID: string = ''
	) {
		const state = wsiApp.app.getState()
		const settings: Settings = state.plots.find(p => p.id === wsiApp.id).settings
		const tileSelections: TileSelection[] = SessionWSImage.getTileSelections(
			sessionWSImage,
			settings.renderSkipped,
			settings.renderOnlyFlagged
		)
		const tileSelection = tileSelections.find(ts => ts.id === currentId)
		const currentIndex = tileSelections.findIndex(ts => ts.id === currentId)
		if (!tileSelection) {
			console.warn('deleteAnnotation called with no tileSelection for currentIndex', {
				currentIndex,
				tileSelectionsLength: tileSelections.length
			})
			return
		}
		if (nextID === '') {
			nextID = SessionWSImage.getNextTileID(
				sessionWSImage,
				settings.renderSkipped,
				settings.renderOnlyFlagged,
				currentIndex
			)
		}
		const source: VectorSource<Feature<Geometry>> | null = vectorLayer.getSource()
		const featuresToRemove: string[] = [
			createFeatureID(FeaturePrefixes.PredBorder, tileSelection.zoomCoordinates),
			createFeatureID(FeaturePrefixes.Square, tileSelection.zoomCoordinates),
			createFeatureID(FeaturePrefixes.Border, tileSelection.zoomCoordinates),
			createFeatureID(FeaturePrefixes.Star, tileSelection.zoomCoordinates),
			'active-border'
		]
		this.removeFeaturesByIds(source!, featuresToRemove)

		if (SessionWSImage.isSessionTileSelection(tileSelection, sessionWSImage)) {
			const sessionsTileSelection = SessionWSImage.removeTileSelection(tileSelection, sessionWSImage)
			wsiApp.app.dispatch({
				type: 'plot_edit',
				id: wsiApp.id,
				config: {
					settings: {
						renderWSIViewer: false,
						renderAnnotationTable: true,
						activeAnnotation: 0,
						activeID: nextID,
						changeTrigger: Date.now(),
						sessionsTileSelection: sessionsTileSelection
					}
				}
			})
			return
		}
		if (classID === undefined) {
			console.warn('deleteAnnotation called but classID is undefined for tileSelection', {
				tileSelection
			})
			return
		}
		const prediction = tileSelections[currentIndex]
		prediction.flag = FlagStatus.Deleted
		const body: DeleteWSITileSelectionRequest = {
			genome: state.vocab.genome,
			dslabel: state.vocab.dslabel,
			projectId: state.aiProjectID,
			classID: classID,
			tileSelection: tileSelections[currentIndex],
			wsimage: sessionWSImage.filename
		}

		try {
			await dofetch3('deleteWSITileSelection', { method: 'DELETE', body })
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
					activeID: nextID,
					changeTrigger: Date.now(),
					sessionsTileSelection: sessionsTileSelection
				}
			}
		})
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
		const existingFeature = source?.getFeatureById(createFeatureID(FeaturePrefixes.PredBorder, zoomCoordinates))
		if (existingFeature) {
			source?.removeFeature(existingFeature)
		}
		const annotatedBorderFeat = this.createBorderFeature(
			topLeft,
			tileSize,
			15,
			color,
			createFeatureID(FeaturePrefixes.Border, zoomCoordinates)
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
		tileSelection: TileSelection,
		selectedClassId: number | undefined,
		aiProjectID: number,
		nextID: string = ''
	) {
		const state = wsiApp.app.getState()
		const body: SaveWSIAnnotationRequest = {
			genome: state.vocab.genome,
			dslabel: state.vocab.dslabel,
			tileSelection: tileSelection,
			classId: selectedClassId!,
			projectId: aiProjectID,
			wsimage: sessionWSImage.filename
		}
		try {
			// TODO add UI rollback
			await dofetch3('saveWSIAnnotation', { method: 'POST', body })
			// TODO find another way to clear server cache
			clearServerDataCache()
		} catch (e) {
			console.error('Error in saveWSIAnnotation request:', e)
		}

		SessionWSImage.removeTileSelection(tileSelection, sessionWSImage)

		const sessionsTileSelection: TileSelection[] = sessionWSImage.sessionsTileSelections ?? []
		// Should only move to next annotation if save is successful, I think save and delete routes should be bool promises
		wsiApp.app.dispatch({
			type: 'plot_edit',
			id: wsiApp.id,
			config: {
				settings: {
					renderWSIViewer: false,
					renderAnnotationTable: true,
					changeTrigger: Date.now(),
					activeAnnotation: 0,
					activeID: nextID,
					isSavingAnnotation: false,
					sessionsTileSelection: sessionsTileSelection
				}
			}
		})
	}
}
