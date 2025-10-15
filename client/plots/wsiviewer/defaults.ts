import type Settings from './Settings'
import { copyMerge } from '#rx'

export default function wsiViewerDefaults(overrides = {}): Settings {
	const defaults: Settings = {
		displayedImageIndex: 0,
		imageWidth: '47vw',
		imageHeight: '25vw',
		activeThumbnailBorderStyle: '2px solid red',
		nonActiveThumbnailBorderStyle: '2px solid black',
		thumbnailWidth: '60px',
		thumbnailHeight: '80px',
		numDisplayedThumbnails: 10,
		thumbnailRangeStart: 0,
		iconDimensions: 20, //20px
		renderWSIViewer: true,
		renderAnnotationTable: false,
		selectedPatchBorderColor: '#FFA500',
		/** Border color for annotated patches */
		annotatedPatchBorderColor: '#D3D3D3',
		tileSize: 512, // 512px
		activeAnnotation: 0,
		sessionsTileSelection: []
	}
	return copyMerge(defaults, overrides)
}
