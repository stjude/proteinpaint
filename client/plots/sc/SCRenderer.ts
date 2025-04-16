import type { MassAppApi } from '#mass/types/mass'
import type { SCDom, SCState } from './SCTypes'
import { renderTable } from '#dom'

/** TODO:
 * - Type file
 * - Add comments/documentation
 */

export class SCRenderer {
	app: MassAppApi
	// config: SCConfig
	dom: SCDom
	state: SCState
	tableData: any
	//On load, show table
	inUse = true

	constructor(app: MassAppApi, state: SCState, dom: SCDom, tableData: any) {
		this.app = app
		this.state = this.app.getState()
		// this.config = structuredClone(state.config)
		this.dom = dom
		this.renderSelectBtn()
		this.renderSamplesTable(tableData)
	}

	renderSelectBtn() {
		const btn = this.dom.selectBtnDiv
			.append('button')
			.attr('data-testid', 'sjpp-sc-sample-table-select-btn')
			.style('border-radius', '20px')
			.style('padding', '5px 10px')
			.style('background-color', 'transparent')
			.text('Select sample and plots')

		const arrowSpan = btn.append('span').style('font-size', '0.8em').style('padding-left', '3px').text('▼')

		btn.on('click', () => {
			this.inUse = !this.inUse
			arrowSpan.text(this.inUse ? '▼' : '▲')
			this.dom.tableDiv.style('display', this.inUse ? 'block' : 'none')
			this.dom.chartBtnsDiv.style('display', this.inUse ? 'block' : 'none')
		})
	}

	renderSamplesTable(tableData) {
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
				//TODO: launch charts per sample
			}
		})
	}

	update() {
		//TODO
	}
}
