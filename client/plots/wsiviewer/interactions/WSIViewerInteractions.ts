import type OLMap from 'ol/Map.js'
import { debounce } from 'debounce'
import { dofetch3 } from '#common/dofetch'

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
			// Add keydown listener to the image container
			const image = holder.select('div > .ol-viewport').attr('tabindex', 0)
			const annotationsData = imageData?.annotationsData || []

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
						//Do not react if at the last annotation
						if (currentIndex == annotationsData.length) return
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
							const newZoomInPoints = annotationsData[currentIndex].zoomCoordinates
							if (newZoomInPoints != undefined) this.addZoomInEffect(activeImageExtent, [newZoomInPoints], map)
							isSpaceDown = false
						}, 500)
						d()
					}
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
					console.log('tmpClass', tmpClass)
					buffers.tmpClass.set(tmpClass)

					const body = {
						coordinates: annotationsData[currentIndex].zoomCoordinates, //Original x,y coordinates
						index: buffers.annotationsIdx.get(),
						confirmed: event.code === 'Enter',
						class: event.code === 'Enter' ? null : event.code.replace('Digit', '').replace('Key', '')
					}

					await dofetch3('sampleWsiAiApi', { body })
				}
			})
		}
	}
}
