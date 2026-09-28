import type { MassAppApi } from '#mass/types/mass'
import { Tabs, type RenderedTab } from '#dom'
import type { DiffAnalysisDom, DiffAnalysisPlotConfig } from '../DiffAnalysisTypes'
import { PROTEOME_DAP, SPLICING } from '#types'

export class DiffAnalysisView {
	app: MassAppApi
	config: DiffAnalysisPlotConfig
	dom: DiffAnalysisDom
	tabs: Tabs
	tabsData: RenderedTab[]
	getTabsOptions: any
	constructor(app: MassAppApi, config: DiffAnalysisPlotConfig, dom: DiffAnalysisDom) {
		this.app = app
		this.config = config
		this.dom = dom
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
				isVisible: () => true,
				// isVisible: () => self.config.termType === TermTypes.GENE_EXPRESSION,
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
				/* Hidden for splicing: GSEA ranks GENES, but a splicing row is an intron cluster and
				a gene usually has several. Flattening them would enter that gene once per cluster
				and weight it accordingly, biasing the enrichment toward splicing-complex (largely
				long) genes. Turning this on needs a cluster->gene rollup rule -- most significant
				cluster per gene, or a Simes combination -- which is a statistical decision, not
				wiring. The volcano already attaches response.daRequest for splicing, so the cacheId
				contract GSEA needs is in place when that rule is chosen. */
				isVisible: () => self.config.termType !== PROTEOME_DAP && self.config.termType !== SPLICING,
				// isVisible: () => self.config.termType === TermTypes.GENE_EXPRESSION,
				getPlotConfig: () => {
					return {
						childType: 'gsea'
					}
				},
				callback: self.tabCallback
			}
		]
		return tabs
	}

	self.tabCallback = async (event, tab) => {
		/** When loading a mass session file, the callback for the
		 * tab will trigger before the plot component is initialized.
		 * check for the event before triggering an app.dispatch.*/
		if (!event || !tab || !tab.id) return
		const plotConfig = tab.getPlotConfig()
		await self.app.dispatch({
			type: 'plot_edit',
			id: self.config.id,
			config: plotConfig
		})
	}
}
