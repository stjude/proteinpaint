import type { BoxPlotDom } from '../BoxPlot'
import type { MassAppApi } from '#mass/types/mass'
import type { RenderedPlot } from '../view/RenderedPlot'
import type { LegendItemEntry } from '../viewModel/LegendDataMapper'
import { to_svg } from '#src/client'
import { ListSamples } from './ListSamples'
import { filterJoin, getFilterItemByTag } from '#filter'

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
		const svg = this.dom.svg.node() as Node
		to_svg(svg, `boxplot`, { apply_dom_styles: true })
	}

	help() {
		//May add more options in the future
		window.open('https://github.com/stjude/proteinpaint/wiki/Box-plot')
	}

	/** Option to add a global filter from the box plot label menu. */
	addFilter(plot: RenderedPlot) {
		const config = this.app.getState()
		const sampleList = new ListSamples(this.app, config, this.id, plot, false)
		const filterUiRoot = getFilterItemByTag(config.termfilter.filter, 'filterUiRoot')
		const filter = filterJoin([filterUiRoot, sampleList.tvslst])
		filter.tag = 'filterUiRoot'
		this.app.dispatch({
			type: 'filter_replace',
			filter
		})
	}

	/** Option to hide a plot from the box plot label menu. */
	hidePlot(plot) {
		const plotConfig = this.app.getState().plots.find(p => p.id === this.id)
		//Don't try to modify a frozen object
		const config = structuredClone(plotConfig)
		const contTerm = config.term.q.mode == 'continuous' ? 'term2' : 'term'
		if (!config[contTerm].q.hiddenValues) config[contTerm].q.hiddenValues = {}
		config[contTerm].q.hiddenValues[plot.key] = 1
		this.app.dispatch({
			type: 'plot_edit',
			id: this.id,
			config: config
		})
	}

	/** Trigger when clicking on a hidden plot in the legend */
	unhidePlot(item: LegendItemEntry) {
		const plotConfig = this.app.getState().plots.find(p => p.id === this.id)
		const config = structuredClone(plotConfig)
		const contTerm = config.term.q.mode == 'continuous' ? 'term2' : 'term'
		delete config[contTerm].q.hiddenValues[item.key]
		this.app.dispatch({
			type: 'plot_edit',
			id: this.id,
			config
		})
	}

	/** Option from box plot label to show the samples in a table within the tooltip. */
	async listSamples(plot: RenderedPlot) {
		const config = this.app.getState()
		const sampleList = new ListSamples(this.app, config, this.id, plot)
		const data = await sampleList.getData()
		const rows = sampleList.setRows(data)
		return rows
	}

	/** Callback for color picker in plot(s) label menu */
	updatePlotColor(plot: RenderedPlot, color: string) {
		if (!plot.seriesId) return
		const plotConfig = this.app.getState().plots.find(p => p.id === this.id)
		const config = structuredClone(plotConfig)
		config.term2.term.values[plot.seriesId].color = color
		this.app.dispatch({
			type: 'plot_edit',
			id: this.id,
			config
		})
	}

	clearDom() {
		this.dom.error.style('padding', '').text('')
		this.dom.plotTitle.text('')
		this.dom.axis.selectAll('*').remove()
		this.dom.boxplots.selectAll('*').remove()
		this.dom.legend.selectAll('*').remove()
	}
}
