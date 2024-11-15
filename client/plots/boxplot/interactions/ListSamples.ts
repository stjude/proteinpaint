import type { MassAppApi, MassState } from '#mass/types/mass'
import type { FormattedPlotEntry } from '../viewModel/ViewModel'
import type { TermWrapper } from '#types'
import type { AnnotatedSampleData } from '../../../types/termdb'
import { roundValueAuto } from '#shared/roundValue.js'

export class ListSamples {
	app: MassAppApi
	dataOpts: {
		terms: any[]
		filter: any
	}
	plot: FormattedPlotEntry
	term: any
	constructor(app: MassAppApi, state: MassState, id: string, min: number, max: number, plot: FormattedPlotEntry) {
		this.app = app
		this.plot = plot
		const plotConfig = state.plots.find((p: { id: string }) => p.id === id)
		if (!plotConfig) throw 'Box plot not found [ListSamples]'
		const tvslst = this.getTvsLst(min, max, plotConfig.term, plotConfig.term2)
		this.term = plotConfig.term.q?.mode === 'continuous' ? plotConfig.term : plotConfig.term2
		const filter = {
			type: 'tvslst',
			join: 'and',
			lst: [state.termfilter.filter, tvslst],
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
				{ value: roundValueAuto((k as Record<string, { value: number }>)[this.term.$id].value) }
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
		const values =
			tw.term.type === 'samplelst'
				? tw.term.values[this.plot.key].list
				: [{ key: this.plot.seriesId, label: this.plot.key }]
		tvslst.lst[lstIdx].tvs.values = values

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
		return (
			tw2.q?.mode === 'continuous' || (['float', 'integer'].includes(tw2.term?.type) && this.plot.overlayBins != null)
		)
	}

	getTvsLst(rangeStart: number, rangeStop: number, tw1: TermWrapper, tw2: TermWrapper) {
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
				this.createTvsLstRanges(tw2, tvslst, rangeStart, rangeStop, 1)
			} else if (this.isContinuousOrBinned(tw2)) {
				this.createTvsTerm(tw2, tvslst)
				tvslst.lst[0].tvs.ranges = this.assignPlotRangeRanges()
				this.createTvsLstRanges(tw1, tvslst, rangeStart, rangeStop, 1)
			} else {
				this.createTvsLstValues(tw2, tvslst, 0)
				this.createTvsLstRanges(tw1, tvslst, rangeStart, rangeStop, 1)
			}
		} else {
			this.createTvsLstRanges(tw1, tvslst, rangeStart, rangeStop, 0)
		}
		return tvslst
	}
}
