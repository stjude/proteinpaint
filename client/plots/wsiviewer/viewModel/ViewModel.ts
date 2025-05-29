import type { WSImage } from '#types'
import type { TableCell } from '#dom'

export class ViewModel {
	imageData: WSImage
	viewData: any

	constructor(imageData: WSImage) {
		this.imageData = imageData

		const data = {}
		this.setAnnonationsTableData(data)
		this.setClassData(data)

		this.viewData = data
	}

	setAnnonationsTableData(data) {
		if (!this.imageData?.annotationsData?.length) return

		//Remove filter() after development
		const annotationsRows: any = this.imageData
			.annotationsData!.filter((_, i) => i < 30)
			.map((d, i) => {
				return [{ value: i }, { value: d.zoomCoordinates }, { value: d.class }]
			})

		const columns = [
			{ label: 'Index', sortable: true, align: 'center' },
			{ label: 'Coordinates' },
			{ label: 'Class', sortable: true }
		]

		data.annotations = {
			rows: annotationsRows,
			columns: columns
		}
	}

	setClassData(data) {
		if (!this.imageData?.classes?.length) return

		const shortcuts: string[] = ['Enter']
		const classRows: TableCell[][] = []
		for (const c of this.imageData.classes) {
			classRows.push([
				{ value: c.label },
				{ html: `<span style="display:inline-block;width:20px;height:20px;background-color:${c.color}"></span>` },
				{ value: c.shortcut.replace('Key', '').replace('Digit', '') }
			])
			shortcuts.push(c.shortcut)
		}
		const columns = [{ label: 'Class' }, { label: 'Color', align: 'center' }, { label: 'Shortcut', align: 'center' }]

		data.classes = {
			rows: classRows,
			columns: columns
		}
		data.shortcuts = shortcuts
	}
}
