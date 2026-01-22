import type { BoxPlotDom, LegendItemEntry, BoxPlotConfig } from '../BoxPlotTypes'
import type { MassAppApi } from '#mass/types/mass'
import type { RenderedPlot } from '../view/RenderedPlot'
import { ListSamples } from '#dom/summary/ListSamples'
import { filterJoin, getFilterItemByTag } from '#filter'

export class BoxPlotInteractions {
	app: MassAppApi
	dom: BoxPlotDom
	id: string
	getResData: () => any

	constructor(app: MassAppApi, dom: BoxPlotDom, id: string, getResData: () => any) {
		this.app = app
		this.dom = dom
		this.id = id
		this.getResData = getResData
	}

	help() {
		//May add more options in the future
		window.open('https://github.com/stjude/proteinpaint/wiki/Box-plot')
	}

	/** Option to add a global filter from the box plot label menu. */
	addFilter(plot: any) {
		const state = this.app.getState()
		const sampleList = this.initListSamples(plot)
		const filterUiRoot = getFilterItemByTag(state.termfilter.filter, 'filterUiRoot')
		const filter = filterJoin([filterUiRoot, sampleList.tvslst])
		filter.tag = 'filterUiRoot'
		this.app.dispatch({
			type: 'filter_replace',
			filter
		})
	}

	/** Option to hide a plot from the box plot label menu. */
	hidePlot(plot: RenderedPlot) {
		const plotConfig = this.getPlotConfig()
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
		const plotConfig = this.getPlotConfig()
		const config = structuredClone(plotConfig)
		const contTerm = config.term.q.mode == 'continuous' ? 'term2' : 'term'
		delete config[contTerm].q.hiddenValues[item.key]
		this.app.dispatch({
			type: 'plot_edit',
			id: this.id,
			config
		})
	}

	initListSamples(plot: any) {
		const state = this.app.getState()
		const plotConfig = this.getPlotConfig()
		const config = structuredClone(plotConfig)
		const bins = this.getResData().bins
		/** Some continuous terms require a range but no
		 * bins are calculated for the response. Passing
		 * the absolute min/max solves this issue. */
		const start = this.getResData().absMin
		const end = this.getResData().absMax
		//The continuous term is always used as the tw
		//Need to update here to match the server req and res
		const contTerm = config.term.q.mode == 'continuous' ? config.term : config.term2
		const term = config.term != contTerm ? contTerm : config.term
		const term2 = config.term != contTerm ? config.term : config.term2
		const sampleList = new ListSamples({
			app: this.app,
			termfilter: state.termfilter,
			term,
			term2,
			term0: config.term0,
			plot,
			bins,
			start,
			end
		})
		return sampleList
	}

	/** Option from box plot label to show the samples in a table within the tooltip. */
	async listSamples(plot: any) {
		const sampleList = this.initListSamples(plot)
		const data = await sampleList.getData()
		const [rows, columns] = sampleList.setTableData(data)
		return [rows, columns]
	}

	/** Callback for color picker in plot(s) label menu */
	updatePlotColor(plot: RenderedPlot, color: string) {
		if (!plot.seriesId) return
		const plotConfig = this.getPlotConfig()
		const config = structuredClone(plotConfig)
		config.term2.term.values[plot.seriesId].color = color
		this.app.dispatch({
			type: 'plot_edit',
			id: this.id,
			config
		})
	}

	getPlotConfig() {
		return this.app.getState().plots.find((p: BoxPlotConfig) => p.id === this.id)
	}

	clearDom() {
		this.dom.error.style('padding', '').text('')
		this.dom.charts.selectAll('*').remove()
		this.dom.legend.selectAll('*').remove()
	}
}
