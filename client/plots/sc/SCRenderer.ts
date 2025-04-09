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
				isVisible: () => true,
				getPlotConfig: () => {
					return {
						childType: 'scSampleTable'
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
			//     isVisible: () => true,
			//     getPlotConfig: () => {
			//         return {
			//             childType: 'violin'
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
		await this.app.dispatch({
			type: 'plot_edit',
			id: this.config.id,
			config: plotConfig
		})
	}

	update(config) {
		const activeTabIndex = this.tabsData.findIndex(tab => tab.id == config.childType)
		this.tabs.update(activeTabIndex)
	}
}
