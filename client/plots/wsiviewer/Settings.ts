import type { TileSelection } from '@sjcrh/proteinpaint-types'

export default interface Settings {
	imageWidth: string
	imageHeight: string
	displayedImageIndex: number
	activeThumbnailBorderStyle: string
	nonActiveThumbnailBorderStyle: string
	thumbnailWidth: string
	thumbnailHeight: string
	/** number of thumbnails shown at one time */
	numDisplayedThumbnails: number
	/** Width and height of previous and next thumbnail icons */
	iconDimensions: number
	renderWSIViewer: boolean
	renderAnnotationTable: boolean
	selectedPatchBorderColor: string
	annotatedPatchBorderColor: string
	tileSize: number
	activeAnnotation: number
	sessionsTileSelection: Array<TileSelection>
}
