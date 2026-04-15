import type { SCDom } from '../SCTypes'
import type { SCInteractions } from '../interactions/SCInteractions'
import { SampleTableRenderer } from './SampleTableRenderer'
import { PlotButtons } from './PlotButtons'
import type { TableData } from '../viewModel/SCViewModel'
import { SectionRender } from './SectionRender'
import type { SCViewer } from '../SC.ts'

export class SCViewRenderer {
	dom: SCDom
	interactions: SCInteractions
	plotBtns: PlotButtons
	//On load, show table
	//Eventually maybe an app dispatch and not a flag
	static inUse = true
	sectionRender: SectionRender
	sc: SCViewer
	// sections: Sections

	constructor(sc: SCViewer) {
		this.sc = sc
		this.dom = sc.dom
		this.interactions = sc.interactions
		this.plotBtns = new PlotButtons(this.interactions, this.dom.plotsBtnsDiv)
		// this.sections = {}
		this.sectionRender = new SectionRender(this.dom.sectionsDiv)
	}

	render(tableData: TableData) {
		this.renderSelectBtn()
		new SampleTableRenderer(this.dom, this.interactions, tableData)
		this.dom.plotsBtnsDiv.style('display', 'none')
	}

	/** Renders the select btn at the top of the page that
	 * show/hides the item table and plot buttons */
	renderSelectBtn() {
		this.dom.selectBtnDiv.style('padding', '10px')

		const btn = this.dom.selectBtnDiv
			.append('button')
			.attr('data-testid', 'sjpp-sc-item-table-select-btn')
			.style('border-radius', '20px')
			.style('padding', '5px 10px')
			.style('background-color', 'transparent')
			//Will need to use ds specific keys/logic here
			.text('Select sample and plots')

		const arrowSpan = btn.append('span').style('font-size', '0.8em').style('padding-left', '3px').text('▼')

		btn.on('click', () => {
			SCViewRenderer.inUse = !SCViewRenderer.inUse
			arrowSpan.text(SCViewRenderer.inUse ? '▼' : '▲')
			this.dom.tableDiv.style('display', SCViewRenderer.inUse ? 'block' : 'none')
			this.dom.plotsBtnsDiv.style('display', SCViewRenderer.inUse ? 'block' : 'none')
		})
	}

	async update(settings, data, subplots) {
		this.plotBtns.update(settings, data)
		await this.sectionRender.update(this.sc, subplots)
	}
}
