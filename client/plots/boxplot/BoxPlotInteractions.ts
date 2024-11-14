import type { BoxPlotDom } from './BoxPlot'
import type { MassAppApi } from '#mass/types/mass'
import { to_svg } from '#src/client'
import { roundValueAuto } from '#shared/roundValue.js'
import { renderTable } from '#dom'

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

	async listSamples(plot: any, min: number, max: number, tip: any) {
		const config = this.app.getState()
		const plotConfig = config.plots.find(p => p.id === this.id)
		const tvslst = getTvsLst(plot, min, max, plotConfig.term, plotConfig.term2 || {})
		const term = plotConfig.term.q?.mode === 'continuous' ? plotConfig.term : plotConfig.term2
		const filter = {
			type: 'tvslst',
			join: 'and',
			lst: [config.termfilter.filter, tvslst],
			in: true
		}
		const opts = {
			terms: [term],
			filter
		}
		const data: { lst: any; refs: any; samples: Record<string, Record<string, { value: number }>> } =
			await this.app.vocabApi.getAnnotatedSampleData(opts)
		const rows: [{ value: string }, { value: number }][] = []
		for (const [c, k] of Object.entries(data.samples))
			rows.push([{ value: data.refs.bySampleId[c].label }, { value: roundValueAuto(k[term.$id].value) }])

		const tableDiv = tip.d.append('div')
		const columns = [{ label: 'Sample' }, { label: 'Value' }]

		renderTable({
			rows,
			columns,
			div: tableDiv,
			maxWidth: '30vw',
			maxHeight: '25vh',
			resize: true,
			showLines: true
		})
	}
}

function createTvsTerm(tw, tvslst) {
	tvslst.lst.push({
		type: 'tvs',
		tvs: {
			term: tw.term
		}
	})
}

function createTvsLstValues(tw, plot, tvslst, lstIdx) {
	createTvsTerm(tw, tvslst)
	const values =
		tw.term.type === 'samplelst' ? tw.term.values[plot.label].list : [{ key: plot.seriesId, label: plot.label }]
	tvslst.lst[lstIdx].tvs.values = values

	if (tw.term.type === 'condition') {
		Object.assign(tvslst.lst[lstIdx].tvs, {
			bar_by_grade: tw.q.bar_by_grade,
			value_by_max_grade: tw.q.value_by_max_grade
		})
	}
}

function createTvsLstRanges(tw, tvslst, rangeStart, rangeStop, lstIdx) {
	createTvsTerm(tw, tvslst)

	tvslst.lst[lstIdx].tvs.ranges = [
		{
			//Only show integers for integer terms
			start: tw.term.type == 'integer' ? Math.round(rangeStart) : rangeStart,
			stop: tw.term.type == 'integer' ? Math.round(rangeStop) : rangeStop,
			startinclusive: true,
			stopinclusive: true,
			startunbounded: false,
			stopunbounded: false
		}
	]
}
function assignPlotRangeRanges(plot) {
	const { start, stop, startinclusive, stopinclusive, startunbounded, stopunbounded } = plot.divideTwBins || {}
	return [
		{
			start: start ?? null,
			stop: stop ?? null,
			startinclusive: startinclusive ?? true,
			stopinclusive: stopinclusive ?? false,
			startunbounded: startunbounded ?? null,
			stopunbounded: stopunbounded ?? null
		}
	]
}

function isContinuousOrBinned(tw2, plot) {
	return tw2.q?.mode === 'continuous' || (['float', 'integer'].includes(tw2.term?.type) && plot.divideTwBins != null)
}

function getTvsLst(plot, rangeStart, rangeStop, tw1, tw2) {
	const tvslst: {
		type: string
		in: boolean
		join: string
		lst: any[]
	} = {
		type: 'tvslst',
		in: true,
		join: 'and',
		lst: []
	}
	const isTw1CategoricalOrCondition = ['categorical', 'condition'].includes(tw1.term.type)

	if (tw2) {
		if (isTw1CategoricalOrCondition) {
			createTvsLstValues(tw1, plot, tvslst, 0)
			createTvsLstRanges(tw2, tvslst, rangeStart, rangeStop, 1)
		} else if (isContinuousOrBinned(tw2, plot)) {
			createTvsTerm(tw2, tvslst)
			tvslst.lst[0].tvs.ranges = assignPlotRangeRanges(plot)
			createTvsLstRanges(tw1, tvslst, rangeStart, rangeStop, 1)
		} else {
			createTvsLstValues(tw2, plot, tvslst, 0)
			createTvsLstRanges(tw1, tvslst, rangeStart, rangeStop, 1)
		}
	} else {
		createTvsLstRanges(tw1, tvslst, rangeStart, rangeStop, 0)
	}
	return tvslst
}
