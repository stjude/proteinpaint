import type { Annotation, WSImage } from '@sjcrh/proteinpaint-types'
import type { WSImageLayers } from '#plots/wsiviewer/viewModel/WSImageLayers.ts'
import type { TableCell } from '#dom'
import { roundValue } from '#shared/roundValue.js'
import type { SessionWSImage } from '#plots/wsiviewer/viewModel/SessionWSImage.ts'
import type { ImageViewData } from '#plots/wsiviewer/viewModel/ImageViewData.ts'

export class ViewModel {
	public sampleWSImages: SessionWSImage[]
	public wsimageLayers: Array<WSImageLayers>
	public wsimageLayersLoadError: string | undefined

	imageViewData: (index: number) => ImageViewData

	constructor(
		sampleWSImages: WSImage[],
		wsimageLayers: WSImageLayers[],
		wsimageLayersLoadError: string | undefined,
		sessionsAnnotations: Annotation[],
		displayedImageIndex: number
	) {
		this.sampleWSImages = sampleWSImages
		this.sampleWSImages[displayedImageIndex].sessionsAnnotations = sessionsAnnotations
		this.wsimageLayers = wsimageLayers
		this.wsimageLayersLoadError = wsimageLayersLoadError
		this.imageViewData = index => this.getImageViewData(index)
	}

	public getImageViewData(index: number): ImageViewData {
		const imageViewData: ImageViewData = {}
		const imageData = this.sampleWSImages[index]
		this.setAnnonationsTableData(imageViewData, imageData)
		this.setClassData(imageViewData, imageData)
		if (imageData?.uncertainty) {
			imageViewData.uncertainty = imageData?.uncertainty
		}
		const metadata = this.wsimageLayers[index].wsimage.get('metadata')
		if (metadata) imageViewData.metadata = metadata

		if (imageData.activePatchColor) imageViewData.activePatchColor = imageData.activePatchColor

		return imageViewData
	}

	public getInitialZoomInCoordinate(index: number) {
		const image = this.sampleWSImages[index]
		const session = image.sessionsAnnotations?.map(a => a.zoomCoordinates) || []
		const persisted = image.annotationsData?.map(a => a.zoomCoordinates) || []
		return [...session, ...persisted].slice(0, 1)
	}

	public setSessionsAnnotations(sessionsAnnotations: Annotation[], displayedImageIndex: number) {
		this.sampleWSImages[displayedImageIndex].sessionsAnnotations = sessionsAnnotations
	}

	private setAnnonationsTableData(imageViewData: ImageViewData, imageData: SessionWSImage) {
		if (!imageData?.annotationsData?.length) return

		// Map session annotations to the same format, starting index at 0
		const sessionAnnotationRows: any = imageData.sessionsAnnotations?.map((d, i) => {
			return [
				{ value: i }, // Index
				{ value: d.zoomCoordinates },
				{ value: 0 },
				{ value: '' },
				{ html: '' },
				{ value: '' }
			]
		})

		// Original annotations follow, indexing continues from session annotations
		const annotationsRows: any = imageData.annotationsData!.map((d, i) => {
			return [
				{ value: imageData.sessionsAnnotations!.length + i }, // Continue index
				{ value: d.zoomCoordinates },
				{ value: roundValue(d.uncertainty, 4) },
				{ value: d.class },
				{ html: '' },
				{ value: '' }
			]
		})

		// Combine: session annotations first
		const mergedRows = [...sessionAnnotationRows, ...annotationsRows]

		const columns = [
			{ label: 'Index', sortable: true, align: 'center' },
			{ label: 'Coordinates' },
			{ label: 'Uncertainty', sortable: true },
			{ label: 'Model-Predicted Class', sortable: true },
			{ label: '', align: 'center' }, //Show the color next to the class
			{ label: 'Annotated Class', sortable: true }
		]

		imageViewData.annotations = {
			rows: mergedRows,
			columns: columns
		}
	}

	private setClassData(imageViewData: ImageViewData, imageData: WSImage) {
		if (!imageData?.classes?.length) return

		const shortcuts: string[] = ['Enter']
		const classRows: TableCell[][] = []
		for (const c of imageData.classes) {
			classRows.push([
				{ value: c.label },
				{
					html: `<span style="display:inline-block;width:20px;height:20px;background-color:${c.color};border:grey 1px solid;"></span>`
				},
				{ value: c.shortcut.replace('Key', '').replace('Digit', '') }
			])
			shortcuts.push(c.shortcut)
		}
		const columns = [{ label: 'Class' }, { label: 'Color', align: 'center' }, { label: 'Shortcut', align: 'center' }]

		imageViewData.classes = {
			rows: classRows,
			columns: columns
		}
		imageViewData.shortcuts = shortcuts
	}
}
