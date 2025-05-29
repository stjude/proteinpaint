import { renderTable } from '#dom'

export class WSImageRenderer {
	holder: any
	viewData: any
	tablesWrapper: any

	constructor(holder, viewData) {
		this.holder = holder
		this.viewData = viewData
		this.tablesWrapper = this.holder
			.append('div')
			.attr('id', 'annotations-table-wrapper')
			.style('display', 'block')
			.style('padding', '20px')

		this.renderAnnotationsTable()
		this.renderClassesTable()
	}

	renderAnnotationsTable() {
		if (!this.viewData.annotations) return
		this.tablesWrapper.select('div[id="annotations-table"]').remove()

		renderTable({
			columns: this.viewData.annotations.columns,
			rows: this.viewData.annotations.rows,
			div: this.tablesWrapper
				.append('div')
				.attr('id', 'annotations-table')
				.style('margins', '20px')
				.style('display', 'inline-block'),
			header: { allowSort: true },
			showLines: false
			// selectedRows: [index]
		})
	}

	renderClassesTable() {
		if (!this.viewData.classes) return
		this.tablesWrapper.select('div[id="annotations-legend"]').remove()
		renderTable({
			columns: this.viewData.classes.columns,
			rows: this.viewData.classes.rows,
			div: this.tablesWrapper
				.append('div')
				.attr('id', 'annotations-legend')
				.style('display', 'inline-block')
				.style('vertical-align', 'top')
				.style('margin-left', '20px'),
			showLines: false
		})
	}
}
