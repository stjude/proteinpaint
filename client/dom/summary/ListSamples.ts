import type { AppApi } from '#rx'
import type { TermWrapper } from '#types'
import type { AnnotatedSampleData } from '../../types/termdb'
import { roundValueAuto } from '#shared/roundValue.js'
import { getSamplelstFilter } from '../../mass/groups.js'
import { TermTypes, isNumericTerm } from '#shared/terms.js'
import { filterJoin } from '#filter'

/**
 * Goal is to make this reusable for other plots.
 *
 * Temp type scoped for this file.
 * Properties required in the plot arg. */
type Plot = {
	chartId?: string //value of divideBy term
	seriesId?: string //value of overlay term
	descrStats?: any
	key: any
	overlayTwBins: any
}

export class ListSamples {
	app: AppApi
	termfilter: any
	plot: Plot
	terms: TermWrapper[]

	t1: TermWrapper
	t2: TermWrapper
	t0?: TermWrapper
	tvslst: {
		type: 'tvslst'
		in: true
		join: 'and'
		lst: any[]
	}
	geneVariant = {}

	constructor(
		app: AppApi,
		termfilter: any,
		config: any,
		plot: Plot,
		/*getRange = true,*/ start?: number,
		end?: number
	) {
		this.app = app
		this.termfilter = termfilter
		this.plot = plot

		this.t1 = config.term
		this.t2 = config.term2
		this.t0 = config?.term0 || null

		this.terms = [this.t1]

		const rangeStart = start ?? this.plot.descrStats.min.value
		const rangeStop = end ?? this.plot.descrStats.max.value

		this.tvslst = {
			type: 'tvslst',
			in: true,
			join: 'and',
			lst: []
		}

		// if (this.hasGeneVariantTerm()) {
		// 	this.geneVariant = {}
		// 	this.handleGeneVariantTerm(rangeStart, rangeStop, getRange)
		// } else {
		this.getTvsLst(rangeStart, rangeStop)
		// }
	}

	// hasGeneVariantTerm(): boolean {
	// 	return this.t1.term.type === TermTypes.GENE_VARIANT || (this.t2 && this.t2.term.type === TermTypes.GENE_VARIANT)
	// }

	// handleGeneVariantTerm(rangeStart: number, rangeStop: number, getRange: boolean): void {
	// 	let tw: TermWrapper
	// 	if (this.t1.term.type === TermTypes.GENE_VARIANT) {
	// 		this.geneVariant.t1value = this.plot.seriesId
	// 		tw = this.t2
	// 	} else {
	// 		this.geneVariant.t2value = this.plot.seriesId
	// 		tw = this.t1
	// 	}
	// 	this.getTvsLst(rangeStart, rangeStop, getRange)
	// }

	getTvsLst(rangeStart: number, rangeStop: number) {
		this.getTvsLstEntry(1, rangeStart, rangeStop)
		if (this.t2) {
			this.terms.push(this.t2)
			this.getTvsLstEntry(2, rangeStart, rangeStop)
			// this.handleOverlayTw(tw1, tw2, getRange, rangeStart, rangeStop)
		}
		if (this.t0) {
			// if (tw2) {
			// 	this.terms.push(tw2)
			// 	// this.handleOverlayTw(tw1, tw2, getRange, rangeStart, rangeStop)
			// }
			this.terms.push(this.t0)
			this.getTvsLstEntry(0, rangeStart, rangeStop)
			// this.handleDivideByTw(tw1, tw0, rangeStart, rangeStop)
		}
		if (!this.t2 && !this.t0) {
			// if (getRange) {
			// 	this.createTvsRanges(rangeStart, rangeStop)
			// }
		}
	}

	getTvsLstEntry(termNum: number, start, stop): void {
		const tw = termNum === 1 ? this.t1 : termNum === 2 ? this.t2 : this.t0
		if (!tw) throw new Error('Missing term wrapper')
		if (tw.type === TermTypes.GENE_VARIANT) {
			/** Not essential to the server req, but used later
			 * for formatting the data rows */
			this.geneVariant[`t${termNum}value`] = this.plot.seriesId
		}
		const tvsEntry = {
			type: 'tvs',
			tvs: {
				term: tw.term
			}
		}
		this.getFilterParams(tvsEntry.tvs, tw, start, stop, termNum)
		this.tvslst.lst.push(tvsEntry)
	}

	getFilterParams(tvs, tw, start: number, stop: number, termNum: number): void {
		const isCatOrCond = [TermTypes.CATEGORICAL, TermTypes.CONDITION].includes(tw.term.type)
		if (isCatOrCond) {
			this.createTvsValues(tvs, tw, termNum)
		} else if (this.isContinuousOrBinned(tw)) {
			this.createTvsRanges(tvs, start, stop, tw)
		} else {
			this.createTvsValues(tvs, tw, termNum)
		}
	}

	createTvsValues(tvs, tw, termNum: number) {
		const key: any = termNum == 0 ? this.plot.chartId : this.plot.seriesId
		if (tw.term.type === TermTypes.SAMPLELST) {
			const ids = tw.term.values[key].list.map(s => s.sampleId)
			// Returns filter obj with lst array of 1 tvs
			const tmpTvsLst = getSamplelstFilter(ids).lst[0]
			tvs.values = tmpTvsLst.lst[0].tvs.values
		} else {
			tvs.values = [{ key }]
		}
		if (tw.term.type === TermTypes.CONDITION) {
			Object.assign(tvs, {
				bar_by_grade: tw.q?.bar_by_grade || null,
				value_by_max_grade: tw.q.value_by_max_grade
			})
		}
	}

	// createTvsTerm(lstIdx: number) {
	// 	const tw = this[`t${lstIdx}`]

	// 	this.tvslst.lst.push({ type: 'tvs', tvs: { term: tw.term } })
	// }

	// handleOverlayTw(tw1: TermWrapper, tw2: TermWrapper, getRange: boolean, rangeStart: number, rangeStop: number) {
	// 	const isTw1CatOrCond = [TermTypes.CATEGORICAL, TermTypes.CONDITION].includes(tw1.term.type)
	// 	if (isTw1CatOrCond) {
	// 		this.createTvsLstValues(tw1, 0)
	// 		if (getRange) this.createTvsLstRanges(tw2, rangeStart, rangeStop, 1)
	// 	} else if (this.isContinuousOrBinned(tw2)) {
	// 		this.createOverlayTwLst(tw2, 0)
	// 		if (getRange) this.createTvsLstRanges(tw1, rangeStart, rangeStop, 1)
	// 	} else {
	// 		this.createTvsLstValues(tw2, 0)
	// 		if (getRange) this.createTvsLstRanges(tw1, rangeStart, rangeStop, 1)
	// 	}
	// }

	// handleDivideByTw(tw1: TermWrapper, tw0: TermWrapper, rangeStart: number, rangeStop: number) {
	// 	const isTw1CatOrCond = [TermTypes.CATEGORICAL, TermTypes.CONDITION].includes(tw1.term.type)
	// 	if (isTw1CatOrCond) {
	// 		this.createTvsLstValues(tw1, 0)
	// 		 this.createTvsLstRanges(tw0, rangeStart, rangeStop, 1)
	// 	} else if (this.isContinuousOrBinned(tw1)) {
	// 		this.createTvsLstRanges(tw1, rangeStart, rangeStop, 0)
	// 		this.createTvsLstValues(tw0, 1)
	// 	} else {
	// 		this.createTvsLstRanges(tw1, rangeStart, rangeStop, 0)
	// 		this.createTvsLstValues(tw0, 1)
	// 	}
	// }

	// createTvsLstValues(tw: any, lstIdx: number) {
	// 	if (tw.term.type === TermTypes.SAMPLELST) {
	// 		const key: any = this.plot.seriesId
	// 		const ids = tw.term.values[key].list.map(s => s.sampleId)
	// 		const tvs = getSamplelstFilter(ids).lst[0] // tvslst is an array of 1 tvs
	// 		this.tvslst.lst[lstIdx] = tvs
	// 	} else this.tvslst.lst[lstIdx].tvs.values = [{ key: this.plot.seriesId, label: this.plot.key }]

	// 	if (tw.term.type === TermTypes.CONDITION) {
	// 		Object.assign(this.tvslst.lst[lstIdx].tvs, {
	// 			bar_by_grade: tw.q?.bar_by_grade || null,
	// 			value_by_max_grade: tw.q.value_by_max_grade
	// 		})
	// 	}
	// }

	createTvsRanges(tvs, rangeStart: number, rangeStop: number, tw) {
		tvs.ranges = [
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

	isContinuousOrBinned(tw2: TermWrapper) {
		if (!('mode' in tw2.q)) return
		return tw2.q?.mode === 'continuous' || (isNumericTerm(tw2.term) && this.plot.overlayTwBins != null)
	}

	// createOverlayTwLst(tw2: TermWrapper, lstIdx: number) {
	// 	this.createTvsTerm(tw2)
	// 	const { start, stop, startinclusive, stopinclusive, startunbounded, stopunbounded } = this.plot.overlayTwBins || {}
	// 	this.tvslst.lst[lstIdx].tvs.ranges = [
	// 		{
	// 			start: start ?? null,
	// 			stop: stop ?? null,
	// 			startinclusive: startinclusive || true,
	// 			stopinclusive: stopinclusive || false,
	// 			startunbounded: startunbounded ?? null,
	// 			stopunbounded: stopunbounded ?? null
	// 		}
	// 	]
	// }

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

	//Formats data rows for #dom renderTable()
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
}
