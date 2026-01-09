import type { AppApi } from '#rx'
import type { TermWrapper } from '#types'
import type { AnnotatedSampleData } from '../../types/termdb'
import type { TableColumn, TableRow } from '#dom'
import { roundValueAuto } from '#shared/roundValue.js'
import { getSamplelstFilter } from '../../mass/groups.js'
import { TermTypes, isNumericTerm } from '#shared/terms.js'
import { filterJoin } from '#filter'
import { addGvRowVals, addGvCols } from '#plots/barchart.events.js'

/** Temp type scoped for this file.
 * Properties required in the plot arg. */
type Plot = {
	chartId?: string //value of divideBy term
	seriesId?: string //value of overlay term
	descrStats?: any //descriptive stats for the plot
	key: any //value of the plot itself
}

/** Constructs the list sample argument needed for the server request.
 * Maybe used for showing the samples to user or creating filters. */
export class ListSamples {
	app: AppApi
	termfilter: any
	plot: Plot
	//from server response
	bins: any

	t1: TermWrapper
	t2: TermWrapper
	t0?: TermWrapper
	terms: TermWrapper[]

	/** Used a reduced range for filtering samples */
	useRange: boolean
	start?: number
	end?: number

	//Created objects
	tvslst: {
		type: 'tvslst'
		in: true
		join: 'and'
		lst: any[]
	}
	//Used for possibly filtering gene variant terms
	geneVariant = {}

	constructor(app: AppApi, termfilter: any, config: any, plot: Plot, start?: number, end?: number) {
		this.app = app
		this.termfilter = termfilter
		this.plot = plot
		this.bins = config.bins || {}

		this.t1 = config.term
		this.t2 = config.term2
		this.t0 = config?.term0 || null

		this.terms = [this.t1]

		if ((start && !end) || (!start && end)) {
			throw new Error('Both start and end must be provided for range filtering')
		}
		if (start && end) {
			this.useRange = true
			this.start = start
			this.end = end
		} else this.useRange = false

		this.tvslst = {
			type: 'tvslst',
			in: true,
			join: 'and',
			lst: []
		}

		this.getTvsLst()
	}

	getTvsLst(): void {
		this.getTvsLstEntry(1)
		if (this.t2) {
			this.terms.push(this.t2)
			this.getTvsLstEntry(2)
		}
		if (this.t0) {
			this.terms.push(this.t0)
			this.getTvsLstEntry(0)
		}
	}

	getTvsLstEntry(termNum: number): void {
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
		this.getFilterParams(tvsEntry.tvs, tw, termNum)
		this.tvslst.lst.push(tvsEntry)
	}

	getFilterParams(tvs: any, tw: TermWrapper, termNum: number): void {
		const key: any = termNum == 0 ? this.plot.chartId : this.plot.seriesId
		if (this.isContinuousOrBinned(tw, termNum)) {
			this.createTvsRanges(tvs, termNum, key)
			this.createTvsValues(tvs, tw, key)
		} else {
			this.createTvsValues(tvs, tw, key)
		}
	}

	createTvsValues(tvs: any, tw: any, key: string): void {
		if (tw.term.type === TermTypes.SAMPLELST) {
			const ids = tw.term.values[key].list.map(s => s.sampleId)
			// Returns filter obj with lst array of 1 tvs
			const tmpTvsLst = getSamplelstFilter(ids).lst[0]
			// Below is the original logic. Keep as a reference for now.
			// tvs.values = tmpTvsLst.lst[0].tvs.values
			tvs.values = tmpTvsLst.tvs.values
		} else {
			tvs.values = [{ key }]
		}

		if (tw.term.type === TermTypes.CONDITION) {
			Object.assign(tvs, {
				bar_by_grade: tw.q?.bar_by_grade || null,
				value_by_max_grade: tw.q.value_by_max_grade
			})
		}

		if (tw.term.type == TermTypes.SURVIVAL) {
			//TODO: This isn't correct. Need to figure out
			//how to filter for survival terms
			const value = tw.term.values[key]
			if (value) tvs.values[0].label = value.label
		}
	}

	createTvsRanges(tvs: any, termNum: number, key: string): void {
		if (termNum == 1 && this.useRange) {
			//May limit the range for the first term (i.e. violin brush)
			tvs.ranges = [
				{
					start: this.start,
					stop: this.end,
					startinclusive: true,
					stopinclusive: true,
					startunbounded: false,
					stopunbounded: false
				}
			]
			return
		}
		const keyBin = this.bins[`term${termNum}`]?.[`${key}`]
		const uncomputable = Object.entries(this[`t${termNum}`].term?.values ?? {}).find(
			([_, v]: [string, any]) => v.label === key && v?.uncomputable
		)?.[0]
		if (keyBin) {
			tvs.ranges = [keyBin]
		} else if (uncomputable) {
			/** Uncomputable values will not have bins defined but
			 * require a value for filtering. Manually adding the
			 * uncomputable key and label filters appropriately.*/
			if (!tvs.ranges) tvs.ranges = []
			tvs.ranges.push({
				value: uncomputable,
				label: key
			})
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

	async getData(): Promise<AnnotatedSampleData> {
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

	//Formats data for #dom renderTable()
	setTableData(data: AnnotatedSampleData): [TableRow[], TableColumn[]] {
		const rows: { value: string | number }[][] = []
		const urlTemplate = this.app.vocabApi.termdbConfig?.urlTemplates?.sample

		for (const s of Object.values(data.lst)) {
			const sampleId = typeof s.sample === 'string' ? s.sample : String(s.sample)
			const row: any[] = [{ value: data.refs.bySampleId[sampleId].label }]
			if (urlTemplate) {
				// sample url template is defined, use it to format sample name as url
				row[0].url = urlTemplate.base + (s[urlTemplate.namekey] || s.sample)
			}
			if (s[this.t1.$id!]) {
				this.addRowValue(s, this.t1, row)
			} else continue //skip rows with no term value
			if (this.t2 && s[this.t2.$id!]) {
				this.addRowValue(s, this.t2, row)
			}
			rows.push(row)
		}

		const columns: TableColumn[] = [{ label: 'Sample' }]
		this.addColValue(this.t1, columns)
		if (this.t2) this.addColValue(this.t2, columns)

		return [rows, columns]
	}

	addRowValue(s: any, tw: TermWrapper, row: TableRow): void {
		const sample = s[tw.$id!]
		let formattedVal
		if (isNumericTerm(tw.term)) {
			formattedVal = roundValueAuto(sample.value)
		} else if (tw.term.type === TermTypes.GENE_VARIANT) {
			//This func mutates row directly
			addGvRowVals(s, tw, row, this.app.vocabApi.termdbMatrixClass)
			return
		} else {
			formattedVal = tw.term.values?.[sample.value]?.label || sample.value
		}
		row.push({ value: formattedVal })
	}

	addColValue(tw: TermWrapper, columns: TableColumn[]): void {
		if (tw.term.type === TermTypes.GENE_VARIANT) {
			//This func mutates columns directly
			addGvCols(tw, columns)
		} else if (tw.term.type == TermTypes.SURVIVAL) {
			//TODO: Skipping for now. Need to figure out how to
			// filter for survival terms
			return
		} else {
			columns.push({ label: tw.term.name })
		}
	}
}
