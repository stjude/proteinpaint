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
import type { Annotation } from '@sjcrh/proteinpaint-types'
import type { SessionWSImage } from '#plots/wsiviewer/viewModel/SessionWSImage.ts'

export class WSIViewerInteractions {
	public activePatchColor?: string
	thumbnailClickListener: (index: number) => void
	zoomInEffectListener: (activeImageExtent: unknown, zoomInPoints: [number, number][], map: OLMap) => void
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
		shortcuts?: string[],
		buffers?: any
	) => void

	constructor(wsiApp: any, opts: any) {
		this.activePatchColor = '#00e62a'
		this.thumbnailClickListener = (index: number) => {
			wsiApp.app.dispatch({
				type: 'plot_edit',
				id: opts.id,
				config: {
					settings: { displayedImageIndex: index, renderWSIViewer: true }
				}
			})
		}
		this.zoomInEffectListener = (activeImageExtent: unknown, zoomInPoints: [number, number][], map: OLMap) => {
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
				this.addActiveBorder(vectorLayer as VectorLayer, zoomCoordinates, this.activePatchColor)
			}, 200)
		}

		this.setKeyDownListener = (
			holder: any,
			sessionWSImage: SessionWSImage,
			map: OLMap,
			activeImageExtent: any,
			shortcuts: string[] = [],
			buffers: any
		) => {
			// Add keydown listener to the holder
			holder.attr('tabindex', 0)
			holder.node()?.focus()

			const sessionAnnotationsData = sessionWSImage?.sessionsAnnotations || []

			const persistedAnnotationsData = sessionWSImage?.annotationsData || []

			const annotationsData = [...sessionAnnotationsData, ...persistedAnnotationsData]

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

				if (idx !== currentIndex) {
					//When the index changes, scroll to the new annotation
					//Timeout for when user presses arrows multiple times.
					const d = debounce(async () => {
						buffers.annotationsIdx.set(currentIndex)
						//
						// const newZoomInPoints = annotationsData[currentIndex].zoomCoordinates
						// if (newZoomInPoints != undefined) this.zoomInEffectListener(activeImageExtent, [newZoomInPoints], map)
					}, 500)
					d()
				}

				if (shortcuts.includes(event.code)) {
					//Update buffer to change table
					let matchingClass = sessionWSImage?.classes?.find(c => c.shortcut === event.code)
					if (!matchingClass) {
						matchingClass = sessionWSImage?.classes?.find(c => c.label === annotationsData[currentIndex].class)
					}
					const tmpClass =
						event.code === 'Enter' || matchingClass!.label == annotationsData[currentIndex].class
							? { label: 'Confirmed', color: matchingClass?.color || '' }
							: { label: matchingClass!.label, color: matchingClass!.color }
					buffers.tmpClass.set(tmpClass)

					this.addAnnotation(vectorLayer!, annotationsData, currentIndex, matchingClass!.color)

					const body = {
						coordinates: annotationsData[currentIndex].zoomCoordinates, //Original x,y coordinates
						index: buffers.annotationsIdx.get(),
						confirmed: event.code === 'Enter',
						class: event.code === 'Enter' ? null : event.code.replace('Digit', '').replace('Key', '')
					}

					//Advance to the next table row after annotating
					const nextIdx = currentIndex + 1
					if (nextIdx < annotationsData.length) {
						buffers.annotationsIdx.set(nextIdx)
						const coords = [annotationsData[nextIdx].zoomCoordinates] as unknown as [number, number][]
						this.zoomInEffectListener(activeImageExtent, coords, map)
					}

					try {
						await dofetch3('sampleWsiAiApi', { body })
					} catch (e) {
						console.error('Error in sampleWsiAiApi request:', e)
					}
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

			const sessionAnnotationsData = sessionWSImage?.sessionsAnnotations || []
			const persistedAnnotationsData = sessionWSImage?.annotationsData || []

			const annotationsData: Annotation[] = [...sessionAnnotationsData, ...persistedAnnotationsData]

			const TILE_SIZE = 512

			// Find the index of the annotation where the point is inside its square
			const selectedAnnotationIndex = annotationsData.findIndex(annotation => {
				const [x0, y0] = annotation.zoomCoordinates
				const x1 = x0 + TILE_SIZE
				const y1 = y0 + TILE_SIZE

				return coordinateX >= x0 && coordinateX < x1 && coordinateY >= y0 && coordinateY < y1
			})

			if (selectedAnnotationIndex !== -1) {
				buffers.annotationsIdx.set(selectedAnnotationIndex)
			} else {
				const sessionAnnotation: Annotation = {
					zoomCoordinates: [coordinateX, coordinateY],
					class: '',
					uncertainty: 0
				}

				const vectorLayer = map
					.getLayers()
					.getArray()
					.find(l => l instanceof VectorLayer)!

				const source: VectorSource<Feature<Geometry>> | null = vectorLayer.getSource()

				const topLeft = [coordinateX, -coordinateY]
				const size = 512
				const borderWth = 30

				const borderCoords = [
					[
						topLeft,
						[topLeft[0] + size, topLeft[1]],
						[topLeft[0] + size, topLeft[1] - size],
						[topLeft[0], topLeft[1] - size],
						topLeft
					],
					[
						[topLeft[0] + borderWth, topLeft[1] - borderWth],
						[topLeft[0] + size - borderWth, topLeft[1] - borderWth],
						[topLeft[0] + size - borderWth, topLeft[1] - size + borderWth],
						[topLeft[0] + borderWth, topLeft[1] - size + borderWth],
						[topLeft[0] + borderWth, topLeft[1] - borderWth]
					]
				]

				const border = new Feature({
					geometry: new Polygon(borderCoords),
					properties: {
						isLocked: false
					}
				})

				border.setStyle(
					new Style({
						fill: new Fill({ color: '#FFA500' }),
						stroke: new Stroke({ color: '#FFA500', width: 1 })
					})
				)

				console.log('source', source)

				source?.addFeature(border)

				const oldAnnotation = settings.sessionsAnnotations

				wsiApp.app.dispatch({
					type: 'plot_edit',
					id: wsiApp.id,
					config: {
						settings: {
							renderWSIViewer: false,
							sessionsAnnotations: [sessionAnnotation, ...oldAnnotation]
						}
					}
				})
			}
		}
	}

	private addAnnotation(vectorLayer: VectorLayer, annotationsData: Annotation[], currentIndex: number, color: any) {
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

		// TODO hardcoded for now.
		const size = 512

		const squareCoords = [
			[
				topLeft,
				[topLeft[0] + size, topLeft[1]],
				[topLeft[0] + size, topLeft[1] - size],
				[topLeft[0], topLeft[1] - size]
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

	private addActiveBorder(vectorLayer: VectorLayer, zoomCoordinates: [number, number], color: any) {
		const source: VectorSource<Feature<Geometry>> | null = vectorLayer.getSource()

		//Remove any previous border on the previous index
		const feature = source?.getFeatureById(`active-border`)
		if (feature) {
			source?.removeFeature(feature)
		}

		const topLeft = zoomCoordinates
		const size = 512
		const borderWth = 50

		const borderCoords = [
			[
				topLeft,
				[topLeft[0] + size, topLeft[1]],
				[topLeft[0] + size, topLeft[1] - size],
				[topLeft[0], topLeft[1] - size],
				topLeft
			],
			[
				[topLeft[0] + borderWth, topLeft[1] - borderWth],
				[topLeft[0] + size - borderWth, topLeft[1] - borderWth],
				[topLeft[0] + size - borderWth, topLeft[1] - size + borderWth],
				[topLeft[0] + borderWth, topLeft[1] - size + borderWth],
				[topLeft[0] + borderWth, topLeft[1] - borderWth]
			]
		]

		const border = new Feature({
			geometry: new Polygon(borderCoords),
			properties: {
				isLocked: false
			}
		})

		border.setId(`active-border`)

		border.setStyle(
			new Style({
				fill: new Fill({ color: color }),
				stroke: new Stroke({ color: color, width: 2 })
			})
		)

		source?.addFeature(border)
	}
}
