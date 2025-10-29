import type TileLayer from 'ol/layer/Tile'
import type Zoomify from 'ol/source/Zoomify'
import type Settings from '#plots/wsiviewer/Settings.ts'
import type { WSIViewerInteractions } from '#plots/wsiviewer/interactions/WSIViewerInteractions.ts'
import { icons, Menu } from '#dom'

export class ThumbnailRenderer {
	constructor() {}

	public render(
		holder: any,
		thumbnailsContainer: any,
		layers: Array<TileLayer<Zoomify> | null>,
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
			//To show truncated names in tooltip on hover
			const tooltip = new Menu()

			// Calculate the range of thumbnails to display
			const startIndex = setting.thumbnailRangeStart
			const endIndex = Math.min(setting.thumbnailRangeStart + setting.numDisplayedThumbnails, layers.length)

			for (let i = startIndex; i < endIndex; i++) {
				const layer = layers[i]
				if (!layer) continue // Skip unloaded layers
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
					.attr('src', layer.get('preview'))
					.attr('alt', `Thumbnail ${i}`)
					.style('max-width', '100%')
					.style('height', '60px')
					.style('object-fit', 'cover')

				// If necessary, truncate long names
				// show full name on hover
				const imageName = layer.get('name') || ''
				let name = imageName
				if (imageName.length > 9) {
					name = imageName.substring(0, 6) + '...'
					thumbnail.on('mouseover', () => {
						tooltip.clear().showunder(thumbnail.node())
						tooltip.d.append('div').style('padding', '5px').text(imageName)
					})
					thumbnail.on('mouseout', () => {
						tooltip.clear().hide()
					})
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
			// Update borders only for visible thumbnails
			const startIndex = setting.thumbnailRangeStart
			const endIndex = Math.min(setting.thumbnailRangeStart + setting.numDisplayedThumbnails, layers.length)
			
			for (let i = startIndex; i < endIndex; i++) {
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
