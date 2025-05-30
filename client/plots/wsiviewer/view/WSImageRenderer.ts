import { renderTable } from '#dom'
import type { ViewData } from '../viewModel/ViewModel'
import type { Elem, Div } from '../../../types/d3'

export class WSImageRenderer {
	holder: Elem
	viewData: ViewData
	tablesWrapper: Div
	buffers: any

	constructor(holder: Elem, viewData: ViewData, buffers: any) {
		this.holder = holder
		this.viewData = viewData
		this.buffers = buffers

		this.holder.select('div[id="annotations-table-wrapper"]').remove()
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

		renderTable({
			columns: this.viewData.annotations.columns,
			rows: this.viewData.annotations.rows,
			div: this.tablesWrapper
				.append('div')
				.attr('id', 'annotations-table')
				.style('margins', '20px')
				.style('display', 'inline-block'),
			header: { allowSort: true },
			showLines: false,
			hoverEffects: (tr, row) => {
				const origColor = tr.style('background-color')
				this.buffers.annotations.addListener((index: number) => {
					if (index === row[0].value) {
						tr.style('background-color', '#fcfcca')
					} else {
						tr.style('background-color', origColor)
					}
				})
			}
		})
	}

	renderClassesTable() {
		if (!this.viewData.classes) return

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
