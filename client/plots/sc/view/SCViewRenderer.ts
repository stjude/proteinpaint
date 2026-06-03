import type { SCActiveSubplot, SCDom, SCFormattedState, SCTableData } from '../SCTypes'
import type { SCInteractions } from '../interactions/SCInteractions'
import { SampleTableRenderer } from './SampleTableRenderer'
import { PlotButtons } from './PlotButtons'
import { SectionRenderer } from './SectionRenderer'
import type { SCViewer } from '../SC.ts'
import type { SubplotManager } from '../subplots/SubplotManager.ts'
import { GroupByOptions, type SCSettings, type Settings } from '../settings/Settings'
import { make_radios } from '#dom'
// import type { SingleCellDataGdc, SingleCellDataNative } from '#types'

/** Manages the initial rendering of the sample table and the dynamic
 * rendering of the plot buttons and sections based on the selected sample and plots.
 * .update() from sc.main() updates the plot buttons and sections. */
export class SCViewRenderer {
	//On load, show table
	//Eventually maybe an app dispatch and not a flag
	static inUse: boolean = true

	sc: SCViewer
	dom: SCDom
	interactions: SCInteractions
	plotBtns!: PlotButtons
	sectionRenderer!: SectionRenderer
	sampleTableRenderer!: SampleTableRenderer

	constructor(sc: SCViewer) {
		this.sc = sc
		this.dom = sc.dom
		this.interactions = sc.interactions
	}

	render(settings: SCSettings, state: SCFormattedState) {
		this.renderSelectBtn()
		this.renderGroupByOptions(settings)
		this.plotBtns = new PlotButtons(this.interactions, this.dom.plotsBtnsDiv, state.termdbConfig)
		this.sectionRenderer = new SectionRenderer(this.dom.sectionsDiv, settings.groupBy)
		// this.dom.plotsBtnsDiv.style('display', 'none')
	}

	/** Renders the select btn at the top of the page that
	 * show/hides the item table and plot buttons */
	renderSelectBtn() {
		this.dom.controlsDiv.style('padding', '10px')

		const btn = this.dom.controlsDiv
			.append('button')
			.attr('data-testid', 'sjpp-sc-item-table-select-btn')
			.attr('title', 'Show/hide sample table and plot buttons')
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

	renderGroupByOptions(settings: SCSettings) {
		this.dom.controlsDiv
			.append('span')
			.style('padding', '3px 0px 3px 20px')
			.style('opacity', 0.7)
			.text('Group plots by:')
		const optionsDiv = this.dom.controlsDiv.append('span').style('display', 'inline-block')
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

	// async update(settings: Settings, data: any, subplots: PlotBase[], tableData: SCTableData) {
	async update(
		settings: Settings,
		data: any,
		activeSubplots: SCActiveSubplot[],
		tableData: SCTableData,
		subplotManager: SubplotManager
	) {
		this.sampleTableRenderer = new SampleTableRenderer(this.dom, this.interactions, tableData)
		this.plotBtns.update(settings, data)
		//Also handles when settings.sc.groupBy == 'none' to show all plots in one section
		// await this.sectionRenderer.update(this.sc, subplots, settings.sc.groupBy)
		await this.sectionRenderer.update(
			this.sc,
			activeSubplots.map(s => s.subplot),
			settings.sc.groupBy
		)
		// const activeSandboxes = this.sectionRenderer.getSampleSandboxes(subplots)
		const activeSandboxes = subplotManager.getSampleSandboxes(activeSubplots)
		this.sampleTableRenderer.updatePlotBtns(activeSandboxes)
	}
}
