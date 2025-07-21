import type { WSImage } from '@sjcrh/proteinpaint-types'
import type { WSImageLayers } from '#plots/wsiviewer/viewModel/WSImageLayers.ts'
import type { TableCell } from '#dom'
import { roundValue } from '#shared/roundValue.js'
import type { SessionAnnotation } from './SessionAnnotation'

export class ViewModel {
	private sessionsAnnotations: SessionAnnotation[]

	public sampleWSImages: WSImage[]
	public wsimageLayers: Array<WSImageLayers>
	public wsimageLayersLoadError: string | undefined

	imageViewData: (index: number) => ImageViewData

	constructor(
		sampleWSImages: WSImage[],
		wsimageLayers: WSImageLayers[],
		wsimageLayersLoadError: string | undefined,
		sessionsAnnotations: SessionAnnotation[]
	) {
		this.sampleWSImages = sampleWSImages
		this.wsimageLayers = wsimageLayers
		this.wsimageLayersLoadError = wsimageLayersLoadError
		this.sessionsAnnotations = sessionsAnnotations
		this.imageViewData = index => this.getImageViewData(index)
	}

	getImageViewData(index: number) {
		const imageViewData: any = {}
		const imageData = this.sampleWSImages[index]
		this.setAnnonationsTableData(imageViewData, imageData, this.sessionsAnnotations)
		this.setClassData(imageViewData, imageData)
		if (imageData?.uncertainty) {
			imageViewData.uncertainty = imageData?.uncertainty
		}
		const metadata = this.wsimageLayers[index].wsimage.get('metadata')
		if (metadata) imageViewData.metadata = metadata

		if (imageData.activePatchColor) imageViewData.activePatchColor = imageData.activePatchColor

		return imageViewData
	}

	getZoomInPoints(index: number) {
		const sessionZoomPoints = this.sessionsAnnotations.map(a => a.zoomCoordinates)

		const persistedZoomPoints = this.sampleWSImages[index].zoomInPoints || []

		return [...sessionZoomPoints, ...persistedZoomPoints]
	}

	setAnnonationsTableData(viewData: any, imageData: WSImage, sessionsAnnotations: SessionAnnotation[]) {
		if (!imageData?.annotationsData?.length) return

		// Map session annotations to the same format, starting index at 0
		const sessionAnnotationRows: any = sessionsAnnotations.map((d, i) => {
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
				{ value: sessionsAnnotations.length + i }, // Continue index
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

		viewData.annotations = {
			rows: mergedRows,
			columns: columns
		}
	}

	setClassData(viewData: any, imageData: WSImage) {
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

		viewData.classes = {
			rows: classRows,
			columns: columns
		}
		viewData.shortcuts = shortcuts
	}
}

export type ImageViewData = {
	annotations?: {
		rows: TableCell[][]
		columns: { label: string; sortable?: boolean; align?: string }[]
	}
	classes?: {
		rows: TableCell[][]
		columns: { label: string; sortable?: boolean; align?: string }[]
	}
	shortcuts?: string[]
	uncertainty?: any
	metadata?: any
}
