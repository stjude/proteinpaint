import type { SCDom, Segments } from '../SCTypes'
import type { SCInteractions } from '../interactions/SCInteractions'
import { PlotSelectionRenderer } from './PlotSelectionRenderer'
import { PlotButtons } from './PlotButtons'

export class SCViewRenderer {
	dom: SCDom
	interactions: SCInteractions
	plotBtns: PlotButtons
	//On load, show table
	//Eventually maybe an app dispatch and not a flag
	static inUse = true
	segments: Segments

	constructor(dom: SCDom, interactions: SCInteractions, segments: Segments) {
		this.dom = dom
		this.interactions = interactions
		this.plotBtns = new PlotButtons(this.interactions, this.dom.plotsBtnsDiv)
		this.segments = segments
	}

	render(tableData) {
		this.renderSelectBtn()
		new PlotSelectionRenderer(this.dom, this.interactions, tableData)
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

	update(settings, data) {
		this.plotBtns.update(settings, data)
	}

	removeSegments() {
		if (!Object.keys(this.segments).length) return
		for (const [key, segment] of Object.entries(this.segments)) {
			//DO NOT use .sjpp-sandbox as the identifier.
			//That div remains after user deletes the plot
			const plots = segment.subplots.selectAll('.sjpp-output-sandbox-header').size()
			if (!plots) {
				segment.title.remove()
				segment.subplots.remove()
				delete this.segments[key]
			}
		}
	}
}
