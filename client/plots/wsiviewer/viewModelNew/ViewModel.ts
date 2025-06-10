import type { WSImage } from '@sjcrh/proteinpaint-types'
import type { WSImageLayers } from '#plots/wsiviewer/viewModelNew/WSImageLayers.ts'
import type { TableCell } from '#dom'
import { roundValue } from '#shared/roundValue.js'

export class ViewModel {
	public sampleWSImages: WSImage[]
	public wsimageLayers: Array<WSImageLayers>
	public wsimageLayersLoadError: string | undefined
	viewData: (index: number) => { annotations?: any; classes?: any; shortcuts?: string[] }

	constructor(
		sampleWSImages: WSImage[],
		wsimageLayers: Array<WSImageLayers>,
		wsimageLayersLoadError: undefined | string
	) {
		this.sampleWSImages = sampleWSImages
		this.wsimageLayers = wsimageLayers
		this.wsimageLayersLoadError = wsimageLayersLoadError
		this.viewData = index => this.getViewData(index)
	}

	getViewData(index: number) {
		const viewData: any = {}
		const imageData = this.sampleWSImages[index]
		this.setAnnonationsTableData(viewData, imageData)
		this.setClassData(viewData, imageData)
		if (imageData?.uncertainty) {
			viewData.uncertainty = imageData?.uncertainty
		}
		const metadata = this.wsimageLayers[index].wsimage.get('metadata')
		if (metadata) viewData.metadata = metadata

		return viewData
	}

	setAnnonationsTableData(viewData: any, imageData: WSImage) {
		if (!imageData?.annotationsData?.length) return

		const annotationsRows: any = imageData.annotationsData!.map((d, i) => {
			const color = imageData?.classes?.find(c => c.label === d.class)?.color || ''

			return [
				{ value: i }, // Index
				{ value: d.zoomCoordinates },
				{ value: roundValue(d.uncertainty, 4) },
				{
					html: `<span style="display:inline-block;width:10px;height:20px;background-color:${color};border:grey 1px solid;"></span>`
				}, //Show the color next to the class
				{ value: d.class },
				{ value: '' } // Annotated class will be set later
			]
		})

		const columns = [
			{ label: 'Index', sortable: true, align: 'center' },
			{ label: 'Coordinates' },
			{ label: 'Uncertainty', sortable: true },
			{ label: '', align: 'center' }, //Show the color next to the class
			{ label: 'Model-Predicted Class', sortable: true },
			{ label: 'Annotated Class', sortable: true }
		]

		viewData.annotations = {
			rows: annotationsRows,
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
