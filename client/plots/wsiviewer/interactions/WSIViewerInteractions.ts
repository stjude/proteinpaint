import type OLMap from 'ol/Map.js'
import { debounce } from 'debounce'
import { dofetch3 } from '#common/dofetch'
import VectorLayer from 'ol/layer/Vector'
import type VectorSource from 'ol/source/Vector'
import { Feature } from 'ol'
import type { Geometry, Polygon } from 'ol/geom'
import { Fill, Stroke, Style } from 'ol/style'

export class WSIViewerInteractions {
	thumbnailClickListener: (index: number) => void
	addZoomInEffect: (activeImageExtent: unknown, zoomInPoints: [number, number][], map: OLMap) => void
	addMapKeyDownListener: (
		holder: any,
		map: OLMap,
		activeImageExtent: any,
		shortcuts?: string[],
		buffers?: any,
		imageData?: any
	) => void

	constructor(wsiApp: any, opts: any) {
		this.thumbnailClickListener = (index: number) => {
			wsiApp.app.dispatch({
				type: 'plot_edit',
				id: opts.id,
				config: {
					settings: { displayedImageIndex: index }
				}
			})
		}
		this.addZoomInEffect = (activeImageExtent: unknown, zoomInPoints: [number, number][], map: OLMap) => {
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

		this.addMapKeyDownListener = (
			holder: any,
			map: OLMap,
			activeImageExtent: any,
			shortcuts: string[] = [],
			buffers: any,
			imageData: any
		) => {
			// Add keydown listener to the holder
			holder.attr('tabindex', 0)
			holder.node()?.focus()

			const annotationsData = imageData?.annotationsData || []

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
				if (idx !== currentIndex) {
					//When the index changes, scroll to the new annotation
					//Timeout for when user presses arrows multiple times.
					const d = debounce(async () => {
						buffers.annotationsIdx.set(currentIndex)
						const newZoomInPoints = annotationsData[currentIndex].zoomCoordinates
						if (newZoomInPoints != undefined) this.addZoomInEffect(activeImageExtent, [newZoomInPoints], map)
					}, 500)
					d()
				}

				if (shortcuts.includes(event.code)) {
					//Update buffer to change table
					let matchingClass = imageData?.classes?.find(c => c.shortcut === event.code)
					if (!matchingClass) {
						matchingClass = imageData?.classes?.find(c => c.label === annotationsData[currentIndex].class)
					}
					const tmpClass =
						event.code === 'Enter' || matchingClass.label == annotationsData[currentIndex].class
							? { label: 'Confirmed', color: matchingClass?.color || '' }
							: { label: matchingClass.label, color: matchingClass.color }
					buffers.tmpClass.set(tmpClass)

					const vectorLayer = map
						.getLayers()
						.getArray()
						.find(l => l instanceof VectorLayer)

					if (!vectorLayer) return

					this.addAnnotation(vectorLayer, annotationsData, currentIndex, matchingClass.color)

					const body = {
						coordinates: annotationsData[currentIndex].zoomCoordinates, //Original x,y coordinates
						index: buffers.annotationsIdx.get(),
						confirmed: event.code === 'Enter',
						class: event.code === 'Enter' ? null : event.code.replace('Digit', '').replace('Key', '')
					}

					await dofetch3('sampleWsiAiApi', { body }).catch()
				}
			})
		}
	}

	private addAnnotation(
		vectorLayer: VectorLayer,
		annotationsData: {
			zoomCoordinates: [number, number]
			type: string
			class: string
			uncertainty: number
		}[],
		currentIndex: number,
		color: any
	) {
		const source: VectorSource<Feature<Geometry>> | null = vectorLayer.getSource()

		const topLeft = [
			annotationsData[currentIndex].zoomCoordinates[0],
			-annotationsData[currentIndex].zoomCoordinates[1]
		]
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

		square.setStyle(
			new Style({
				fill: new Fill({ color: color }),
				stroke: new Stroke({ color: color })
			})
		)

		source?.addFeature(square)
	}
}
