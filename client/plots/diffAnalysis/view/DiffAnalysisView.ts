import type { MassAppApi } from '#mass/types/mass'
import { Tabs } from '#dom'
import type { DiffAnalysisDom } from '../DiffAnalysisTypes'

/** TODO: finish typing this file */
export class DiffAnalysisView {
	app: MassAppApi
	config: any
	dom: DiffAnalysisDom
	renderers: any
	tabs: any
	tabsData: any
	getTabsOptions: any
	constructor(app, config, dom: DiffAnalysisDom) {
		this.app = app
		this.dom = dom
		this.config = config
		setRenderers(this)
		this.tabsData = this.getTabsOptions(this)
		this.tabs = new Tabs({ holder: this.dom.tabsDiv, content: this.dom.tabsContent, tabs: this.tabsData })
		this.tabs.main()
	}

	update(plotConfig) {
		const activeTabIndex = this.tabsData.findIndex(tab => tab.id == plotConfig.childType)
		this.tabs.update(activeTabIndex)
	}
}

function setRenderers(self) {
	self.getTabsOptions = self => {
		const tabs = [
			{
				active: self.config.childType === 'volcano',
				id: 'volcano',
				label: 'Volcano',
				getPlotConfig: () => {
					return {
						childType: 'volcano'
					}
				},
				callback: self.tabCallback
			},
			{
				active: self.config.childType === 'gsea',
				id: 'gsea',
				label: 'Gene Set Enrichment Analysis',
				getPlotConfig: () => {
					return {
						childType: 'gsea',
						settings: {
							controls: {
								isOpen: true
							}
						}
					}
				},
				callback: self.tabCallback
			}
		]
		return tabs
	}

	//event is used in Tabs but not needed here
	self.tabCallback = async (event, tab) => {
		if (!tab || !tab.id) return
		const plotConfig = tab.getPlotConfig()
		await self.app.dispatch({
			type: 'plot_edit',
			id: self.config.id,
			config: plotConfig
		})
	}
}
