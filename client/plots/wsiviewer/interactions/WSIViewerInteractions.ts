import type OLMap from 'ol/Map.js'

export class WSIViewerInteractions {
	thumbnailClickListener: (index: number) => void
	addZoomInEffect: (activeImageExtent: unknown, zoomInPoints: [number, number][], map: OLMap) => void

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
	}
}
