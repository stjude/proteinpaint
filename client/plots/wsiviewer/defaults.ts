import Settings from './Settings'

export default function wsiViewerDefaults(overrides = {}): Settings {
	const defaults = {
		displayedImageIndex: 0,
		imageWidth: '47vw',
		imageHeight: '25vw',
		activeThumbnailBorderStyle: '2px solid red',
		nonActiveThumbnailBorderStyle: '2px solid black',
		thumbnailWidth: '60px',
		thumbnailHeight: '80px'
	}
	return defaults
}
