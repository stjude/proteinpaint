import type { SCDom } from '../SCTypes'
import type { SCInteractions } from '../interactions/SCInteractions'
import { ChartsSelectionRenderer } from './ChartsSelectionRenderer'
import { ChartButtons } from './ChartButtons'

export class SCViewRenderer {
	dom: SCDom
	interactions: SCInteractions
	chartBtns: ChartButtons
	//On load, show table
	//Eventually maybe an app dispatch and not a flag
	static inUse = true

	constructor(dom: SCDom, interactions: SCInteractions) {
		this.dom = dom
		this.interactions = interactions
		this.chartBtns = new ChartButtons(this.interactions, this.dom.chartBtnsDiv)
	}

	render(tableData) {
		this.renderSelectBtn()
		new ChartsSelectionRenderer(this.dom, this.interactions, tableData)
		this.dom.chartBtnsDiv.style('display', 'none')
	}

	/** Renders the select btn at the top of the page that
	 * show/hides the sample table and plot buttons */
	renderSelectBtn() {
		this.dom.selectBtnDiv.style('padding', '10px')

		const btn = this.dom.selectBtnDiv
			.append('button')
			.attr('data-testid', 'sjpp-sc-sample-table-select-btn')
			.style('border-radius', '20px')
			.style('padding', '5px 10px')
			.style('background-color', 'transparent')
			.text('Select sample and plots')

		const arrowSpan = btn.append('span').style('font-size', '0.8em').style('padding-left', '3px').text('▼')

		btn.on('click', () => {
			SCViewRenderer.inUse = !SCViewRenderer.inUse
			arrowSpan.text(SCViewRenderer.inUse ? '▼' : '▲')
			this.dom.tableDiv.style('display', SCViewRenderer.inUse ? 'block' : 'none')
			this.dom.chartBtnsDiv.style('display', SCViewRenderer.inUse ? 'block' : 'none')
		})
	}

	update(settings) {
		this.chartBtns.update(settings?.sample)
	}
}
