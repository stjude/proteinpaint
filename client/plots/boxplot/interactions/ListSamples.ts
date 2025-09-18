import type { MassAppApi, MassState } from '#mass/types/mass'
import type { RenderedPlot } from '../view/RenderedPlot'
import type { TermWrapper } from '#types'
import type { AnnotatedSampleData } from '../../../types/termdb'
import { roundValueAuto } from '#shared/roundValue.js'
import { getSamplelstFilter } from '../../../mass/groups.js'

export class ListSamples {
	app: MassAppApi
	dataOpts: {
		terms: any[]
		filter: any
	}
	plot: RenderedPlot
	term: any
	tvslst: any
	constructor(app: MassAppApi, state: MassState, id: string, plot: RenderedPlot, getRange = true) {
		this.app = app
		this.plot = plot

		const plotConfig = state.plots.find((p: { id: string }) => p.id === id)
		if (!plotConfig) throw 'Box plot not found [ListSamples]'

		try {
			//ids 'min' and 'max' are always present in the descrStats{}
			const min = plot.descrStats.min.value
			const max = plot.descrStats.max.value
			this.tvslst = this.getTvsLst(min, max, getRange, plotConfig.term, plotConfig.term2)
		} catch (e: any) {
			console.error(e.message || e)
		}

		this.term = plotConfig.term.q?.mode === 'continuous' ? plotConfig.term : plotConfig.term2

		const filter = {
			type: 'tvslst',
			join: 'and',
			lst: [state.termfilter.filter, this.tvslst],
			in: true
		}
		this.dataOpts = {
			terms: [this.term],
			filter
		}
	}

	async getData() {
		return await this.app.vocabApi.getAnnotatedSampleData(this.dataOpts)
	}

	setRows(data: AnnotatedSampleData) {
		const rows: [{ value: string }, { value: number }][] = []
		for (const [c, k] of Object.entries(data.samples))
			rows.push([
				{ value: data.refs.bySampleId[c].label },
				{ value: Number(roundValueAuto((k as Record<string, { value: number }>)[this.term.$id].value)) }
			])
		return rows
	}

	createTvsTerm(tw: TermWrapper, tvslst: any) {
		tvslst.lst.push({
			type: 'tvs',
			tvs: {
				term: tw.term
			}
		})
	}

	createTvsLstValues(tw: any, tvslst: any, lstIdx: number) {
		this.createTvsTerm(tw, tvslst)
		if (tw.term.type === 'samplelst') {
			const key: any = this.plot.seriesId
			const ids = tw.term.values[key].list.map(s => s.sampleId)
			const tvs = getSamplelstFilter(ids).lst[0] // tvslst is an array of 1 tvs
			tvslst.lst[lstIdx] = tvs
		} else tvslst.lst[lstIdx].tvs.values = [{ key: this.plot.seriesId, label: this.plot.key }]

		if (tw.term.type === 'condition') {
			Object.assign(tvslst.lst[lstIdx].tvs, {
				bar_by_grade: tw.q?.bar_by_grade || null,
				value_by_max_grade: tw.q.value_by_max_grade
			})
		}
	}

	createTvsLstRanges(tw: TermWrapper, tvslst: any, rangeStart: number, rangeStop: number, lstIdx: number) {
		this.createTvsTerm(tw, tvslst)

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

	assignPlotRangeRanges() {
		const { start, stop, startinclusive, stopinclusive, startunbounded, stopunbounded } = this.plot.overlayBins || {}
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

	isContinuousOrBinned(tw2: TermWrapper) {
		if (!('mode' in tw2.q)) return
		return (
			tw2.q?.mode === 'continuous' || (['float', 'integer'].includes(tw2.term?.type) && this.plot.overlayBins != null)
		)
	}

	getTvsLst(rangeStart: number, rangeStop: number, getRange = true, tw1: TermWrapper, tw2: TermWrapper) {
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
				this.createTvsLstValues(tw1, tvslst, 0)
				if (getRange) this.createTvsLstRanges(tw2, tvslst, rangeStart, rangeStop, 1)
			} else if (this.isContinuousOrBinned(tw2)) {
				this.createTvsTerm(tw2, tvslst)
				tvslst.lst[0].tvs.ranges = this.assignPlotRangeRanges()
				if (getRange) this.createTvsLstRanges(tw1, tvslst, rangeStart, rangeStop, 1)
			} else {
				this.createTvsLstValues(tw2, tvslst, 0)
				if (getRange) this.createTvsLstRanges(tw1, tvslst, rangeStart, rangeStop, 1)
			}
		} else {
			if (getRange) this.createTvsLstRanges(tw1, tvslst, rangeStart, rangeStop, 0)
		}

		return tvslst
	}
}
