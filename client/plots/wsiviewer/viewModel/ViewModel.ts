import type { TileSelection, WSImage } from '@sjcrh/proteinpaint-types'
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
		sessionsTileSelections: TileSelection[],
		displayedImageIndex: number
	) {
		this.sampleWSImages = sampleWSImages
		if (this.sampleWSImages[displayedImageIndex]) {
			this.sampleWSImages[displayedImageIndex].sessionsTileSelections = sessionsTileSelections
		}
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
		const sessionsTileSelections = image.sessionsTileSelections?.map(a => a.zoomCoordinates) || []
		const predictions = image.predictions?.map(a => a.zoomCoordinates) || []
		const persistedAnnotations = image.annotations?.map(a => a.zoomCoordinates) || []
		return [...sessionsTileSelections, ...predictions, ...persistedAnnotations].slice(0, 1)
	}

	private setAnnonationsTableData(imageViewData: ImageViewData, imageData: SessionWSImage) {
		if (!imageData?.annotations?.length && !imageData?.predictions?.length) return

		// Map session annotations to the same format, starting index at 0
		const sessionsTileSelections: any = imageData.sessionsTileSelections?.map((d, i) => {
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
		const predictionRows: any = imageData.predictions!.map((d, i) => {
			return [
				{ value: imageData.sessionsTileSelections!.length + i }, // Continue index
				{ value: d.zoomCoordinates },
				{ value: roundValue(d.uncertainty, 4) },
				{ value: d.class },
				{ html: '' },
				{ value: '' }
			]
		})

		// Original annotations follow, indexing continues from session annotations
		const annotationsRows: any = imageData.annotations!.map((d, i) => {
			return [
				{ value: imageData.sessionsTileSelections!.length + imageData.predictions!.length + i }, // Continue index
				{ value: d.zoomCoordinates },
				{ value: 0 },
				{ value: '' },
				{ html: '' },
				{ value: d.class }
			]
		})

		// Combine: session annotations first
		const mergedRows = [...sessionsTileSelections, ...predictionRows, ...annotationsRows]

		const columns = [
			{ label: 'Index', sortable: true, align: 'center' },
			{ label: 'Coordinates' },
			{ label: 'Uncertainty', sortable: true },
			{ label: 'Model-Predicted Class', sortable: true },
			{ label: '', align: 'center' }, //Show the color next to the class
			{ label: 'Annotated Class', sortable: true }
		]

		imageViewData.tilesTable = {
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
				{ value: c.key_shortcut.replace('Key', '').replace('Digit', '') }
			])
			shortcuts.push(c.key_shortcut)
		}
		const columns = [{ label: 'Class' }, { label: 'Color', align: 'center' }, { label: 'Shortcut', align: 'center' }]

		imageViewData.classesTable = {
			rows: classRows,
			columns: columns
		}
		imageViewData.shortcuts = shortcuts
	}
}
