import type { SCDom, SCTableData } from '../SCTypes'
import type { TableCell } from '#dom'
import type { SCInteractions } from '../interactions/SCInteractions'
import { renderTable } from '#dom'
import { PlotButtons } from './PlotButtons'

/** Renders the sc app */
export class ChartsSelectionRenderer {
	dom: SCDom
	plotButtons: PlotButtons
	//On load, show table
	//Eventually maybe an app dispatch and not a flag
	inUse = true

	constructor(interactions: SCInteractions, dom: SCDom, tableData: SCTableData) {
		this.dom = dom
		this.renderSelectBtn()
		this.renderSamplesTable(tableData)

		this.plotButtons = new PlotButtons(interactions, this.dom.plotBtnsDiv)
	}

	/** Renders the select btn at the top of the page that
	 * show/hides the sample table and plot buttons */
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
			//Only toggle if a sample is selected (i.e. don't show on load)
			if (this.plotButtons.sample) this.dom.plotBtnsDiv.style('display', this.inUse ? 'block' : 'none')
		})
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
				//Update() renders the plot buttons
				this.plotButtons.update(sample)
				this.dom.plotBtnsDiv.style('display', 'block')
			}
		})
	}

	update() {
		//TODO - will update the plots in the dashboard
	}
}
