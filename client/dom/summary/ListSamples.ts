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
	descrStats?: any //descriptive stats for the plot
	key: any //value of the plot itself
}

/** Constructs the list sample argument needed for the server request.
 * Maybe used for showing the samples to user or creating filters.
 *
 * Note: hold over code to accommodate the violin brush is commented out.
 * Will reimplement if needed.
 */
export class ListSamples {
	app: AppApi
	termfilter: any
	plot: Plot
	terms: TermWrapper[]
	bins: any

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
		plot: Plot
		/*getRange = true, 
		start?: number,
		end?: number*/
	) {
		this.app = app
		this.termfilter = termfilter
		this.plot = plot
		this.bins = config.bins || {}

		this.t1 = config.term
		this.t2 = config.term2
		this.t0 = config?.term0 || null

		this.terms = [this.t1]

		// const rangeStart = start ?? this.plot.descrStats.min.value
		// const rangeStop = end ?? this.plot.descrStats.max.value

		this.tvslst = {
			type: 'tvslst',
			in: true,
			join: 'and',
			lst: []
		}

		this.getTvsLst(/*rangeStart, rangeStop*/)
	}

	getTvsLst(/*rangeStart: number, rangeStop: number*/) {
		this.getTvsLstEntry(1 /*rangeStart, rangeStop*/)
		if (this.t2) {
			this.terms.push(this.t2)
			this.getTvsLstEntry(2 /*rangeStart, rangeStop*/)
		}
		if (this.t0) {
			this.terms.push(this.t0)
			this.getTvsLstEntry(0 /*rangeStart, rangeStop*/)
		}
		if (!this.t2 && !this.t0) {
			// if (getRange) {
			// 	this.createTvsRanges(rangeStart, rangeStop)
			// }
		}
	}

	getTvsLstEntry(termNum: number /*start: number, stop: number*/): void {
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
		this.getFilterParams(tvsEntry.tvs, tw, /*start, stop,*/ termNum)
		this.tvslst.lst.push(tvsEntry)
	}

	getFilterParams(tvs: any, tw: TermWrapper, /*start: number, stop: number,*/ termNum: number): void {
		const key: any = termNum == 0 ? this.plot.chartId : this.plot.seriesId
		// const isCatOrCond = [TermTypes.CATEGORICAL, TermTypes.CONDITION].includes(tw.term.type)
		// if (isCatOrCond) {
		// 	this.createTvsValues(tvs, tw, key)
		// } else
		if (this.isContinuousOrBinned(tw, termNum)) {
			this.createTvsRanges(tvs, termNum, key)
			this.createTvsValues(tvs, tw, key)
		} else {
			this.createTvsValues(tvs, tw, key)
		}
	}

	createTvsValues(tvs: any, tw: any, key: string) {
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

	createTvsRanges(tvs, termNum, key) {
		const keyBin = this.bins[`term${termNum}`]?.[`${key}`]
		if (keyBin) {
			tvs.ranges = [keyBin]
		} else {
			//Continuous terms may not have bins defined
			tvs.ranges = []
		}
	}

	isContinuousOrBinned(tw: TermWrapper, termNum: number): boolean {
		if (!('mode' in tw.q)) return false
		return (
			tw.q?.mode === 'continuous' || (isNumericTerm(tw.term) && Object.keys(this.bins[`term${termNum}`]).length != 0)
		)
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

	//Formats data rows for #dom renderTable()
	setRows(data: AnnotatedSampleData): { value: string | number }[][] {
		const rows: { value: string | number }[][] = []

		const formatValue = (val: any, term: TermWrapper) => {
			if (isNumericTerm(term.term)) {
				return roundValueAuto(val)
			} else {
				return val
			}
		}

		for (const s of Object.values(data.lst)) {
			const sampleId = typeof s.sample === 'string' ? s.sample : String(s.sample)
			const row: any[] = [{ value: data.refs.bySampleId[sampleId].label }]
			if (s[this.t1.$id!]) row.push({ value: formatValue(s[this.t1.$id!].value, this.t1) })
			if (s[this.t2.$id!]) row.push({ value: formatValue(s[this.t2.$id!].value, this.t2) })
			rows.push(row)
		}
		return rows
	}
}
