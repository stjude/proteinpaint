import type { WSImage } from '@sjcrh/proteinpaint-types'
import type { WSImageLayers } from '#plots/wsiviewer/viewModel/WSImageLayers.ts'
import type { TableCell } from '#dom'
import { SessionWSImage } from '#plots/wsiviewer/viewModel/SessionWSImage.ts'
import type { ImageViewData } from '#plots/wsiviewer/viewModel/ImageViewData.ts'
import type Settings from '#plots/wsiviewer/Settings.ts'

export class ViewModel {
	public sampleWSImages: SessionWSImage[]
	public wsimageLayers: Array<WSImageLayers>
	public wsimageLayersLoadError: string | undefined
	public selectedTileIndex: number

	imageViewData: (index: number) => ImageViewData

	constructor(
		sampleWSImages: WSImage[],
		wsimageLayers: WSImageLayers[],
		wsimageLayersLoadError: string | undefined,
		settings: Settings
	) {
		this.sampleWSImages = sampleWSImages
		if (this.sampleWSImages[settings.displayedImageIndex]) {
			this.sampleWSImages[settings.displayedImageIndex].sessionsTileSelections = settings.sessionsTileSelection
		}
		this.selectedTileIndex = settings.activeAnnotation
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

	public getInitialZoomInCoordinate(settings: Settings) {
		const image = this.sampleWSImages[settings.displayedImageIndex]
		return SessionWSImage.getTileSelections(image)
			.map(a => a.zoomCoordinates)
			.slice(settings.activeAnnotation, settings.activeAnnotation + 1)
	}

	private setAnnonationsTableData(imageViewData: ImageViewData, imageData: SessionWSImage) {
		const mergedRows: any[] = SessionWSImage.getTilesTableRows(imageData, this.selectedTileIndex)

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
