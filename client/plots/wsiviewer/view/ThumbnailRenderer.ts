import type TileLayer from 'ol/layer/Tile'
import type Zoomify from 'ol/source/Zoomify'
import type Settings from '#plots/wsiviewer/Settings.ts'
import type { WSIViewerInteractions } from '#plots/wsiviewer/interactions/WSIViewerInteractions.ts'

export class ThumbnailRenderer {
	constructor() {}

	public render(
		holder: any,
		thumbnailsContainer: any,
		layers: Array<TileLayer<Zoomify>>,
		setting: Settings,
		wsiViewerInteractions: WSIViewerInteractions
	) {
		if (!thumbnailsContainer) {
			// First-time initialization
			thumbnailsContainer = holder
				.append('div')
				.attr('id', 'thumbnails')
				.attr('data-testid', 'sjpp-thumbnails')
				.style('width', '600px')
				.style('height', '80px')
				.style('display', 'flex')
				.style('margin-left', '20px')
				.style('margin-bottom', '20px')

			for (let i = 0; i < layers.length; i++) {
				const isActive = i === setting.displayedImageIndex
				const thumbnail = thumbnailsContainer
					.append('div')
					.attr('id', `thumbnail${i}`)
					.style('width', setting.thumbnailWidth)
					.style('height', setting.thumbnailHeight)
					.style('margin-right', '10px')
					.style('display', 'flex')
					.style('height', 'auto')
					.style('align-items', 'center')
					.style('justify-content', 'center')
					.style('border', isActive ? setting.activeThumbnailBorderStyle : setting.nonActiveThumbnailBorderStyle)
					.style('cursor', 'pointer')
					.on('click', () => {
						wsiViewerInteractions.thumbnailClickListener(i)
					})

				thumbnail
					.append('img')
					.attr('src', layers[i].get('preview'))
					.attr('alt', `Thumbnail ${i}`)
					.style('max-width', '100%')
					.style('height', '60px')
					.style('object-fit', 'cover')
			}
		} else {
			// Update borders only
			for (let i = 0; i < layers.length; i++) {
				const isActive = i === setting.displayedImageIndex
				holder
					.select(`#thumbnail${i}`)
					.style('border', isActive ? setting.activeThumbnailBorderStyle : setting.nonActiveThumbnailBorderStyle)
			}
		}

		return thumbnailsContainer
	}
}
