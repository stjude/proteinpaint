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
		wsiViewerInteractions: WSIViewerInteractions,
		numTotalFiles: number
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

			for (let i = 0; i < layers.length; i++) {
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

				let name = layers[i].get('name') || ''
				if (name.length > 15) {
					name = name.substring(0, 12) + '...'
				}
				thumbnail.append('span').style('font-size', '0.85em').style('text-wrap', 'wrap').text(name)
			}

			//Placeholder for right arrow, if needed
			const rightIconHolder = thumbnailsContainer.append('div').style('display', 'flex').style('align-items', 'center')

			/** Only show display arrows (i.e. prev/next buttons) when
			 * the num of thumbnails exceeds the num that can be displayed*/
			if (numTotalFiles > setting.numDisplayedThumbnails) {
				icons['left'](leftIconHolder, {
					width: setting.iconDimensions,
					height: setting.iconDimensions,
					disabled: setting.thumbnailRangeStart === 0,
					handler: () => {
						wsiViewerInteractions.toggleThumbnails(this.newStart(setting, numTotalFiles, true))
					}
				})

				icons['right'](rightIconHolder, {
					width: setting.iconDimensions,
					height: setting.iconDimensions,
					disabled: setting.thumbnailRangeStart + setting.numDisplayedThumbnails >= numTotalFiles,
					handler: () => {
						wsiViewerInteractions.toggleThumbnails(this.newStart(setting, numTotalFiles))
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

	private newStart(setting, numTotalFiles, isLeft = false) {
		if (isLeft) {
			return Math.max(0, setting.thumbnailRangeStart - setting.numDisplayedThumbnails)
		} else {
			return Math.min(
				numTotalFiles - setting.numDisplayedThumbnails,
				setting.thumbnailRangeStart + setting.numDisplayedThumbnails
			)
		}
	}
}
