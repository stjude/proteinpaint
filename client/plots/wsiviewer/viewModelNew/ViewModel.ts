import type { WSImage } from '@sjcrh/proteinpaint-types'
import type { WSImageLayers } from '#plots/wsiviewer/viewModelNew/WSImageLayers.ts'
import type { TableCell } from '#dom'
import { roundValue } from '#shared/roundValue.js'

export class ViewModel {
	public sampleWSImages: WSImage[]
	public wsimageLayers: Array<WSImageLayers>
	public wsimageLayersLoadError: string | undefined
	viewData: (imageData: WSImage) => { annotations?: any; classes?: any; shortcuts?: string[] }

	constructor(
		sampleWSImages: WSImage[],
		wsimageLayers: Array<WSImageLayers>,
		wsimageLayersLoadError: undefined | string
	) {
		this.sampleWSImages = sampleWSImages
		this.wsimageLayers = wsimageLayers
		this.wsimageLayersLoadError = wsimageLayersLoadError
		this.viewData = imageData => this.getViewData(imageData)
	}

	getViewData(imageData: WSImage) {
		const viewData: any = {}
		this.setAnnonationsTableData(viewData, imageData)
		this.setClassData(viewData, imageData)
		if (imageData?.uncertainty) {
			viewData.uncertainty = imageData?.uncertainty
		}

		return viewData
	}

	setAnnonationsTableData(viewData: any, imageData: WSImage) {
		if (!imageData?.annotationsData?.length) return

		//Remove filter() after development
		const annotationsRows: any = imageData
			.annotationsData!.filter((_, i) => i < 30)
			.map((d, i) => {
				return [{ value: i }, { value: d.zoomCoordinates }, { value: roundValue(d.uncertainty, 4) }, { value: d.class }]
			})

		const columns = [
			{ label: 'Index', sortable: true, align: 'center' },
			{ label: 'Coordinates' },
			{ label: 'Uncertainty', sortable: true },
			{ label: 'Model-Predicted Class', sortable: true }
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
				{ html: `<span style="display:inline-block;width:20px;height:20px;background-color:${c.color}"></span>` },
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
