import type { MassAppApi } from '#mass/types/mass'
import { Tabs } from '#dom'
import type { DiffAnalysisDom, DiffAnalysisSettings, DiffAnalysisViewData } from '../DiffAnalysisTypes'
import type { DiffAnalysisInteractions } from '../interactions/DiffAnalysisInteractions'
import { VolcanoPlot } from './VolcanoPlot'

/** TODO: finish typing this file */
export class View {
	constructor(
		app: MassAppApi,
		dom: DiffAnalysisDom,
		interactions: DiffAnalysisInteractions,
		settings: DiffAnalysisSettings,
		viewData: DiffAnalysisViewData
	) {
		interactions.clearDom()

		this.renderDom(app, dom, settings, viewData, interactions)
	}

	renderDom(app, dom, settings, viewData, interactions) {
		const tabs = [
			{
				active: true,
				id: 'volcano',
				label: 'Volcano',
				callback: () => {
					new VolcanoPlot(app, dom, settings, viewData, interactions)
				}
			}
		]
		new Tabs({
			holder: dom.tabs,
			content: dom.tabsContent,
			tabs
		}).main()
	}
}
