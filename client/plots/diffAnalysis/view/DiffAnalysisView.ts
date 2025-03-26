import type { MassAppApi } from '#mass/types/mass'
import { Tabs } from '#dom'
import type { RenderedTab } from '#dom'
import type { DiffAnalysisDom, DiffAnalysisPlotConfig } from '../DiffAnalysisTypes'
import type { DiffAnalysisInteractions } from '../interactions/DiffAnalysisInteractions'

/** TODO: finish typing this file */
export class DiffAnalysisView {
	app: MassAppApi
	config: DiffAnalysisPlotConfig
	dom: DiffAnalysisDom
	interactions: DiffAnalysisInteractions
	tabs: Tabs
	tabsData: RenderedTab[]
	getTabsOptions: any
	constructor(
		app: MassAppApi,
		config: DiffAnalysisPlotConfig,
		dom: DiffAnalysisDom,
		interactions: DiffAnalysisInteractions
	) {
		this.app = app
		this.config = config
		this.dom = dom
		this.interactions = interactions
		setRenderers(this)
		this.tabsData = this.getTabsOptions(this)
		this.tabs = new Tabs({ holder: this.dom.tabsDiv, tabs: this.tabsData })
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
				isVisible: () => self.config.termType === 'geneExpression',
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
				isVisible: () => self.config.termType === 'geneExpression',
				getPlotConfig: () => {
					const gsea_params = self.interactions.getGseaParameters()
					return {
						childType: 'gsea',
						gsea_params
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
