import type { SCDom } from '../SCTypes'
import type { SCInteractions } from '../interactions/SCInteractions'
import { SampleTableRenderer } from './SampleTableRenderer'
import { PlotButtons } from './PlotButtons'
import type { TableData } from '../viewModel/SCViewModel'
import { SectionRender } from './SectionRender'
import type { SCViewer } from '../SC.ts'
import { GroupByOptions } from '../settings/Settings'
import { make_radios } from '#dom'

export class SCViewRenderer {
	dom: SCDom
	interactions: SCInteractions
	plotBtns: PlotButtons
	//On load, show table
	//Eventually maybe an app dispatch and not a flag
	static inUse = true
	sectionRender: SectionRender
	sc: SCViewer

	constructor(sc: SCViewer) {
		this.sc = sc
		this.dom = sc.dom
		this.interactions = sc.interactions
		this.plotBtns = new PlotButtons(this.interactions, this.dom.plotsBtnsDiv)
		this.sectionRender = new SectionRender(this.dom.sectionsDiv, sc.state.config.settings.sc.groupBy)
	}

	render(tableData: TableData, settings) {
		this.renderSelectBtn()
		this.renderGroupByOptions(settings)
		new SampleTableRenderer(this.dom, this.interactions, tableData)
		this.dom.plotsBtnsDiv.style('display', 'none')
	}

	/** Renders the select btn at the top of the page that
	 * show/hides the item table and plot buttons */
	renderSelectBtn() {
		this.dom.controlsDiv.style('padding', '10px')

		const btn = this.dom.controlsDiv
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

	renderGroupByOptions(settings) {
		this.dom.controlsDiv.append('span').style('margin-left', '20px').style('opacity', 0.7).text('Group plots by:')
		const optionsDiv = this.dom.controlsDiv.append('div').style('display', 'inline-block').style('margin-left', '10px')
		const options = GroupByOptions.map(option => {
			return {
				label: `${option.charAt(0).toUpperCase() + option.slice(1)}`,
				value: option,
				checked: settings.groupBy === option
			}
		})
		make_radios({
			holder: optionsDiv,
			styles: { display: 'inline-block' },
			options,
			callback: async value => {
				await this.sc.app.dispatch({
					type: 'plot_edit',
					id: this.sc.id,
					config: { settings: { sc: { ...settings, groupBy: value } } }
				})
			}
		})
	}

	async update(settings, data, subplots) {
		this.plotBtns.update(settings, data)
		//Also handles when settings.sc.groupBy == 'none' to show all plots in one section
		await this.sectionRender.update(this.sc, subplots, settings.sc.groupBy)
	}
}
