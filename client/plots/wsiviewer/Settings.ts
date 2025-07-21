import type { SessionAnnotation } from '#plots/wsiviewer/viewModel/SessionAnnotation.ts'

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
	activeAnnotation: number
	sessionsAnnotations: Array<SessionAnnotation>
}
