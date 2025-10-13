import type TileLayer from 'ol/layer/Tile'
import type Zoomify from 'ol/source/Zoomify'
import type Settings from '#plots/wsiviewer/Settings.ts'
import type { WSIViewerInteractions } from '#plots/wsiviewer/interactions/WSIViewerInteractions.ts'
import { icons } from '#dom'

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
				.style('display', 'none') // Initially hidden
				.attr('data-testid', 'sjpp-thumbnails')
				.style('width', '600px')
				.style('height', '80px')
				.style('display', 'flex')
				.style('margin-left', '20px')
				.style('margin-bottom', '20px')

			// Placeholder for left arrow, if needed
			const leftIconHolder = thumbnailsContainer.append('div').style('display', 'flex').style('align-items', 'center')

			for (let i = setting.thumbnailRangeStart; i < this.lastShownImage(setting, layers.length); i++) {
				const isActive = i === setting.displayedImageIndex
				const thumbnail = thumbnailsContainer
					.append('div')
					.attr('id', `thumbnail${i}`)
					.style('width', setting.thumbnailWidth)
					.style('height', setting.thumbnailHeight)
					.style('margin', '0 5px')
					.style('display', 'flex')
					.style('flex-direction', 'column')
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

				thumbnail
					.append('span')
					.style('font-size', '0.85em')
					.text(layers[i].get('name') || '')
			}

			//Placeholder for right arrow, if needed
			const rightIconHolder = thumbnailsContainer.append('div').style('display', 'flex').style('align-items', 'center')

			/** Only show display arrows (i.e. prev/next buttons) when
			 * the num of thumbnails exceeds the num that can be displayed*/
			if (layers.length > setting.numDisplayedThumbnails) {
				icons['left'](leftIconHolder, {
					width: setting.iconDimensions,
					height: setting.iconDimensions,
					disabled: setting.thumbnailRangeStart === 0,
					handler: () => {
						wsiViewerInteractions.toggleThumbnails(this.newStart(setting, layers, true))
					}
				})

				icons['right'](rightIconHolder, {
					width: setting.iconDimensions,
					height: setting.iconDimensions,
					disabled: setting.thumbnailRangeStart + setting.numDisplayedThumbnails >= layers.length,
					handler: () => {
						wsiViewerInteractions.toggleThumbnails(this.newStart(setting, layers))
					}
				})
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

	private lastShownImage(setting, layersLength) {
		return setting.thumbnailRangeStart + setting.numDisplayedThumbnails >= layersLength
			? layersLength
			: setting.thumbnailRangeStart + setting.numDisplayedThumbnails
	}

	private newStart(setting, layers, isLeft = false) {
		if (isLeft) {
			return Math.max(0, setting.thumbnailRangeStart - setting.numDisplayedThumbnails)
		} else {
			return Math.min(
				layers.length - setting.numDisplayedThumbnails,
				setting.thumbnailRangeStart + setting.numDisplayedThumbnails
			)
		}
	}
}
