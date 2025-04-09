import { Tabs } from '#dom'
import type { MassAppApi, MassState } from '#mass/types/mass'
import type { SCConfig } from './SCTypes'

export class SCRenderer {
	app: MassAppApi
	config: SCConfig
	dom: any
	state: MassState
	tabs: Tabs
	tabsData: any
	/** Only show certain tabs when a sample is selected */
	#showDependentTabs = false

	constructor(app, dom, state) {
		this.app = app
		this.state = state
		this.config = structuredClone(state.config)
		this.dom = dom
		this.tabsData = this.getTabsOptions()
		this.tabs = new Tabs({ holder: this.dom.tabsDiv, tabs: this.tabsData })
		this.tabs.main()
	}

	getTabsOptions() {
		// const scQueries = this.state.termdbConfig.queries.singleCell
		const tabs = [
			{
				active: this.config.childType === 'scSampleTable',
				id: 'scSampleTable',
				label: 'Samples',
				isVisible: () => this.#showDependentTabs,
				getPlotConfig: () => {
					return {
						childType: 'scSampleTable'
					}
				},
				callback: this.tabCallback
			},
			{
				active: this.config.childType === 'singleCell',
				id: 'singleCell',
				label: 'Plots',
				isVisible: () => this.#showDependentTabs,
				getPlotConfig: () => {
					/** TODO: will need to see if additional needs
					 * for this config. plots, hiddenClusters, etc. */
					return {
						childType: 'singleCell'
					}
				},
				callback: this.tabCallback
			}
			// {
			//     active: this.config.childType === 'differentialAnalysis',
			//     id: 'differentialAnalysis',
			//     label: 'Differential Expression',
			//     isVisible: () => scQueries?.DEgenes,
			//     getPlotConfig: () => {
			//         return {
			//             //Need to figure out how to launch a child plot
			//             //that is also a parent component
			//             childType: 'differentialAnalysis'
			//         }
			//     },
			//     callback: this.tabCallback
			// },
			// {
			//     active: this.config.childType === 'violin',
			//     id: 'violin',
			//     label: 'Summary',
			//     isVisible: () => this.#showDependentTabs,
			//     getPlotConfig: () => {
			//         return {
			//             childType: 'violin'
			//             //TODO: finish this config
			//         }
			//     },
			//     callback: this.tabCallback
			// },
			//This might be a reusable holder just for images.
			// {
			//     active: this.config.childType === 'scImages',
			//     id: 'scImages',
			//     label: scQueries?.images?.label || 'Images',
			//     isVisible: () => scQueries?.images,
			//     getPlotConfig: () => {
			//         return {
			//             childType: 'scImages'
			//         }
			//     },
			//     callback: this.tabCallback
			// },
		]
		return tabs
	}

	tabCallback = async (event, tab) => {
		if (!tab || !tab.id) return
		const plotConfig = tab.getPlotConfig()
		tab.isVisible()
		await this.app.dispatch({
			type: 'plot_edit',
			id: this.config.id,
			config: plotConfig
		})
	}

	samplePresent() {
		//determine whether or not to show certain tabs
		const config = this.app.getState().plots.find((p: SCConfig) => p.id === this.config.id)
		return config?.sample ? true : false
	}

	update(config) {
		const activeTabIndex = this.tabsData.findIndex(tab => tab.id == config.childType)
		/** Determine once if plots dependent on a sample present in
		 * this config should be shown.*/
		const samplePresent = this.samplePresent()
		if (this.#showDependentTabs == false) this.#showDependentTabs = samplePresent
		this.tabs.update(activeTabIndex)

		//Show the sample details above the plots tabs
		if (samplePresent) {
			this.dom.infoDiv.selectAll('*').remove()
			for (const [key, value] of Object.entries(config.sample)) {
				const div = this.dom.infoDiv.append('div').style('display', 'inline-block').style('margin', '10px')
				div.append('span').style('opacity', 0.65).style('font-size', '0.8em').text(`${key.toUpperCase()}: `)
				div.append('span').text(value)
			}
		}
	}
}
