import type { TileSelection } from '@sjcrh/proteinpaint-types'

export default interface Settings {
	imageWidth: string
	imageHeight: string
	displayedImageIndex: number
	activeThumbnailBorderStyle: string
	nonActiveThumbnailBorderStyle: string
	thumbnailWidth: string
	thumbnailHeight: string
	renderWSIViewer: boolean
	renderAnnotationTable: boolean
	selectedPatchBorderColor: string
	annotatedPatchBorderColor: string
	tileSize: number
	activeAnnotation: number
	sessionsTileSelection: Array<TileSelection>
}
