import type { BoxPlotDom } from '../BoxPlot'
import type { MassAppApi } from '#mass/types/mass'
import type { FormattedPlotEntry } from '../viewModel/ViewModel'
import type { LegendItemEntry } from '../viewModel/LegendDataMapper'
import { to_svg } from '#src/client'
import { ListSamples } from './ListSamples'

export class BoxPlotInteractions {
	app: MassAppApi
	dom: BoxPlotDom
	id: string
	constructor(app: MassAppApi, dom: BoxPlotDom, id: string) {
		this.app = app
		this.dom = dom
		this.id = id
	}

	setVarAfterInit(app: MassAppApi, id: string) {
		// app and id created after init
		// Avoid ts from complaining, reset here
		if (this.app == undefined) this.app = app
		if (this.id == undefined) this.id = id
	}

	download() {
		//May add more options in the future
		const svg = this.dom.div.select('svg').node() as Node
		to_svg(svg, `boxplot`, { apply_dom_styles: true })
	}

	help() {
		//May add more options in the future
		window.open('https://github.com/stjude/proteinpaint/wiki/Box-plot')
	}

	async listSamples(plot: FormattedPlotEntry, min: number, max: number) {
		const config = this.app.getState()
		const sampleList = new ListSamples(this.app, config, this.id, min, max, plot)
		const data = await sampleList.getData()
		const rows = sampleList.setRows(data)
		return rows
	}

	unhidePlot(item: LegendItemEntry) {
		const plotConfig = this.app.getState().plots.find(p => p.id === this.id)
		const config = structuredClone(plotConfig)
		const contTerm = config.term.q.mode == 'continuous' ? 'term2' : 'term'
		delete config[contTerm].q.hiddenValues[item.label]
		this.app.dispatch({
			type: 'plot_edit',
			id: this.id,
			config
		})
	}
}
