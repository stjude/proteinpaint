import type { MassAppApi } from '#mass/types/mass'
import type { SCDom, SCState } from '../SCTypes'
import type { TableCell } from '#dom'
import { renderTable } from '#dom'
import { PlotButtons } from './PlotButtons'

/** TODO:
 * - Type file
 * - Add comments/documentation
 */

export class SCView {
	app: MassAppApi
	// config: SCConfig
	dom: SCDom
	state: SCState
	tableData: any
	//On load, show table
	inUse = true
	plotButtons: PlotButtons

	constructor(app: MassAppApi, state: SCState, dom: SCDom, tableData: any) {
		this.app = app
		this.state = this.app.getState()
		// this.config = structuredClone(state.config)
		this.dom = dom
		this.renderSelectBtn()
		this.renderSamplesTable(tableData)

		this.plotButtons = new PlotButtons(this.dom.plotBtnsDiv)
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
			//Only toggle if a sample is selected
			if (this.plotButtons.sample) this.dom.plotBtnsDiv.style('display', this.inUse ? 'block' : 'none')
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
				const sample = {}
				tableData.rows[index].forEach((r: TableCell, idx: number) => {
					if (!r.value) return
					sample[tableData.columns[idx].label.toLowerCase()] = r.value
				})

				this.plotButtons.update(sample)
				this.dom.plotBtnsDiv.style('display', 'block')
			}
		})
	}

	update() {
		//TODO - will update the plots in the dashboard
	}
}
