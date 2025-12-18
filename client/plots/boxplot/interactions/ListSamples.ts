import type { AppApi } from '#rx'
import type { TermWrapper } from '#types'
import type { AnnotatedSampleData } from '../../../types/termdb'
import { roundValueAuto } from '#shared/roundValue.js'
import { getSamplelstFilter } from '../../../mass/groups.js'
import { TermTypes } from '#shared/terms.js'
import { filterJoin } from '#filter'

/**
 * Goal is to make this reusable for other plots.
 * Eventually move to a shared location.
 *
 * Temp type scoped for this file.
 * Properties required in the plot arg. */
type Plot = {
	seriesId: string
	descrStats: any
	key: any
	overlayTwBins: any
}

export class ListSamples {
	app: AppApi
	termfilter: any
	plot: Plot
	terms: TermWrapper[]
	tvslst: any
	t1: TermWrapper
	t2: TermWrapper
	t0?: TermWrapper
	geneVariant: any

	constructor(app: AppApi, termfilter: any, config: any, plot: Plot, getRange = true, start?: number, end?: number) {
		this.app = app
		this.termfilter = termfilter
		this.plot = plot
		this.t1 = config.term
		this.t2 = config.term2
		if (config.term0) this.t0 = config.term0

		this.terms = [this.t1]

		const rangeStart = start ?? this.plot.descrStats.min.value
		const rangeStop = end ?? this.plot.descrStats.max.value

		if (this.hasGeneVariantTerm()) {
			this.geneVariant = {}
			this.handleGeneVariantTerm(rangeStart, rangeStop, getRange)
		} else {
			this.tvslst = this.getTvsLst(rangeStart, rangeStop, getRange, this.t1, this.t2)
		}
	}

	hasGeneVariantTerm(): boolean {
		return this.t1.term.type === TermTypes.GENE_VARIANT || (this.t2 && this.t2.term.type === TermTypes.GENE_VARIANT)
	}

	handleGeneVariantTerm(rangeStart: number, rangeStop: number, getRange: boolean): void {
		let tw: TermWrapper
		if (this.t1.term.type === TermTypes.GENE_VARIANT) {
			this.geneVariant.t1value = this.plot.seriesId
			tw = this.t2
		} else {
			this.geneVariant.t2value = this.plot.seriesId
			tw = this.t1
		}
		this.tvslst = this.getTvsLst(rangeStart, rangeStop, getRange, tw, null)
	}

	getTvsLst(rangeStart: number, rangeStop: number, getRange: boolean, tw1: TermWrapper, tw2?: TermWrapper | null) {
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

		if (tw2) {
			this.terms.push(tw2)
			this.handleTw2(tw1, tw2, tvslst, getRange, rangeStart, rangeStop)
		} else {
			if (getRange) this.createTvsLstRanges(tw1, tvslst, rangeStart, rangeStop, 0)
		}

		return tvslst
	}

	handleTw2(tw1: TermWrapper, tw2: TermWrapper, tvslst: any, getRange: boolean, rangeStart: number, rangeStop: number) {
		const isTw1CatOrCond = [TermTypes.CATEGORICAL, TermTypes.CONDITION].includes(tw1.term.type)
		if (isTw1CatOrCond) {
			this.createTvsLstValues(tw1, tvslst, 0)
			if (getRange) this.createTvsLstRanges(tw2, tvslst, rangeStart, rangeStop, 1)
		} else if (this.isContinuousOrBinned(tw2)) {
			tvslst.lst[0].tvs.ranges = this.createOverlayTwLst(tw2, tvslst)
			if (getRange) this.createTvsLstRanges(tw1, tvslst, rangeStart, rangeStop, 1)
		} else {
			this.createTvsLstValues(tw2, tvslst, 0)
			if (getRange) this.createTvsLstRanges(tw1, tvslst, rangeStart, rangeStop, 1)
		}
	}

	createTvsLstValues(tw: any, tvslst: any, lstIdx: number) {
		this.createTvsTerm(tw, tvslst)
		if (tw.term.type === TermTypes.SAMPLELST) {
			const key: any = this.plot.seriesId
			const ids = tw.term.values[key].list.map(s => s.sampleId)
			const tvs = getSamplelstFilter(ids).lst[0] // tvslst is an array of 1 tvs
			tvslst.lst[lstIdx] = tvs
		} else tvslst.lst[lstIdx].tvs.values = [{ key: this.plot.seriesId, label: this.plot.key }]

		if (tw.term.type === TermTypes.CONDITION) {
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
				start: tw.term.type == TermTypes.INTEGER ? Math.round(rangeStart) : rangeStart,
				stop: tw.term.type == TermTypes.INTEGER ? Math.round(rangeStop) : rangeStop,
				startinclusive: true,
				stopinclusive: true,
				startunbounded: false,
				stopunbounded: false
			}
		]
	}

	createTvsTerm(tw: TermWrapper, tvslst: any) {
		tvslst.lst.push({ type: 'tvs', tvs: { term: tw.term } })
	}

	isContinuousOrBinned(tw2: TermWrapper) {
		if (!('mode' in tw2.q)) return
		return (
			tw2.q?.mode === 'continuous' || (['float', 'integer'].includes(tw2.term?.type) && this.plot.overlayTwBins != null)
		)
	}

	createOverlayTwLst(tw2: TermWrapper, tvslst: any) {
		this.createTvsTerm(tw2, tvslst)
		const { start, stop, startinclusive, stopinclusive, startunbounded, stopunbounded } = this.plot.overlayTwBins || {}
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

	setRows(data: AnnotatedSampleData) {
		const rows: [{ value: string }, { value: number }][] = []
		for (const [c, k] of Object.entries(data.samples)) {
			if (!this.t1.$id) throw new Error('Missing term.$id')
			rows.push([
				{ value: data.refs.bySampleId[c].label },
				{ value: Number(roundValueAuto((k as Record<string, { value: number }>)[this.t1.$id].value)) }
			])
		}
		return rows
	}

	async getData() {
		try {
			const opts = {
				terms: this.terms,
				filter: filterJoin([this.termfilter.filter, this.tvslst]),
				filter0: this.termfilter.filter0,
				isSummary: true
			}
			const data = await this.app.vocabApi.getAnnotatedSampleData(opts)
			if (!data) throw new Error('No sample data returned')
			return data
		} catch (e: any) {
			throw new Error(e)
		}
	}
}
