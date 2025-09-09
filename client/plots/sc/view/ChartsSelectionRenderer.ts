import type { SCDom, SCTableData } from '../SCTypes'
import type { TableCell } from '#dom'
import { renderTable } from '#dom'
import type { SCInteractions } from '../interactions/SCInteractions'

/** Renders the sc app */
export class ChartsSelectionRenderer {
	dom: SCDom
	interactions: SCInteractions

	constructor(dom: SCDom, interactions: SCInteractions, tableData: SCTableData) {
		this.dom = dom
		this.interactions = interactions
		this.renderSamplesTable(tableData)
	}

	/** Users select one sample at a time to render the plot buttons
	 * to init() plots in the dashboard.*/
	renderSamplesTable(tableData: SCTableData) {
		renderTable({
			rows: tableData.rows,
			columns: tableData.columns,
			div: this.dom.tableDiv,
			singleMode: true,
			maxWidth: tableData.columns.length > 3 ? '98vw' : '40vw',
			maxHeight: '30vh',
			header: {
				allowSort: true,
				style: { 'text-transform': 'capitalize' }
			},
			striped: true,
			selectedRows: tableData.selectedRows,
			noButtonCallback: index => {
				const sample = {}
				tableData.rows[index].forEach((r: TableCell, idx: number) => {
					if (!r.value) return
					sample[tableData.columns[idx].label.toLowerCase()] = r.value
				})
				this.interactions.updateSample(sample)
				this.dom.chartBtnsDiv.style('display', 'block')
			}
		})
	}
}
