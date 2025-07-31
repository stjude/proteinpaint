import type { Annotation } from '@sjcrh/proteinpaint-types'

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
	tileSize: number
	activeAnnotation: number
	sessionsAnnotations: Array<Annotation>
}
