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
	/** Created by the server */
	bins: any

	t1: TermWrapper
	t2: TermWrapper
	t0?: TermWrapper
	terms: TermWrapper[]

	/** Indicates a reduced range than then bin (e.g. violin brush) */
	useRange: boolean
	start?: number
	end?: number

	/*******************
	 * Created objects *
	 *******************/
	tvslst: {
		type: 'tvslst'
		in: true
		join: 'and'
		lst: any[]
	}
	/** For filtering gene variant terms later */
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

		const noValue = v => {
			return v === null || v === undefined
		}
		if ((start && noValue(end)) || (noValue(start) && end)) {
			throw new Error('Both start and end must be provided for range filtering')
		}
		if (!noValue(start) && !noValue(end)) {
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
		if (tw.term.type === TermTypes.GENE_VARIANT) {
			this.geneVariant[`t${termNum}value`] = this.plot.seriesId
			return
		}
		let tvsEntry = {
			type: 'tvs',
			tvs: {
				term: tw.term
			}
		}
		tvsEntry = this.getFilterParams(tvsEntry, tw, termNum)
		this.tvslst.lst.push(tvsEntry)
	}

	getFilterParams(tvsEntry: any, tw: TermWrapper, termNum: number) {
		const key: any = termNum == 0 ? this.plot.chartId : this.plot.seriesId
		if (this.isContinuousOrBinned(tw, termNum)) {
			this.createTvsRanges(tvsEntry.tvs, termNum, key)
		}
		return this.createTvsValues(tvsEntry, tw, key)
	}

	createTvsValues(tvsEntry: any, tw: any, key: string) {
		if (
			(tw?.q?.type == 'custom-groupset' || tw?.q?.type == 'predefined-groupset') &&
			tw.term.type !== TermTypes.GENE_VARIANT
		) {
			const groupset =
				tw.q.type == 'custom-groupset' ? tw.q.customset : tw.term.groupsetting.lst[tw.q.predefined_groupset_idx]
			const group = groupset.groups.find(group => group.name == key)
			if (!group) throw new Error(`Group not found in groupset for ${tw.term.name}: ${key}`)
			tvsEntry.tvs.values = group.values
		} else if (tw.term.type === TermTypes.SAMPLELST) {
			if (!tw.term.values?.[key]) throw new Error(`Sample list not found for ${tw.term.name}: ${key}`)
			const ids = tw.term.values[key].list.map(s => s.sampleId)
			// Returns filter obj with lst array of 1 tvs
			const tmpTvsLst = getSamplelstFilter(ids)
			tvsEntry = tmpTvsLst.lst[0]
		} else {
			tvsEntry.tvs.values = [{ key }]
		}
		if (tw.term.type === TermTypes.CONDITION) {
			Object.assign(tvsEntry.tvs, {
				bar_by_grade: tw.q?.bar_by_grade || null,
				value_by_max_grade: tw.q.value_by_max_grade
			})
		}
		return tvsEntry
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

	/** Formats the data for #dom/table/renderTable() */
	setTableData(data: AnnotatedSampleData): [TableRow[], TableColumn[]] {
		//Validation check
		const foundInvalidGvTerm = [this.t1, this.t2, this.t0].find(tw => {
			return tw && tw.term.type === TermTypes.GENE_VARIANT && (tw?.q as any)?.type == 'values'
		})
		if (foundInvalidGvTerm) throw new Error('q.type = values are not supported for gene variant terms')

		//Formatting rows
		const rows: { value: string | number }[][] = []
		const urlTemplate = this.app.vocabApi.termdbConfig?.urlTemplates?.sample

		for (const s of Object.values(data.lst)) {
			const filterSample = this.mayFilterGVSample(s)
			if (filterSample) continue
			const sampleId = typeof s.sample === 'string' ? s.sample : String(s.sample)
			const row: any[] = [{ value: data.refs.bySampleId[sampleId].label }]
			if (urlTemplate) {
				// sample url template is defined, use it to format sample name as url
				row[0].url = urlTemplate.base + (s[urlTemplate.namekey] || s.sample)
			}
			if (s[this.t1.$id!]) {
				if (this.t1?.q?.hiddenValues && this.t1?.q.hiddenValues[s[this.t1.$id!].value]) {
					continue //skip hidden values
				} else this.addRowValue(s, this.t1, row)
			} else continue //skip rows with no term value
			if (this.t2) {
				if (this.t2?.q?.hiddenValues && this.t2?.q.hiddenValues[s[this.t2.$id!].value]) {
					continue
				}
				if (s[this.t2.$id!]) this.addRowValue(s, this.t2, row)
			}
			rows.push(row)
		}

		//Formatting columns
		const columns: TableColumn[] = [{ label: 'Sample' }]
		this.addColValue(this.t1, columns)
		if (this.t2) this.addColValue(this.t2, columns)

		return [rows, columns]
	}

	mayFilterGVSample(sample): boolean {
		let filterSample = false
		for (const [idx, tw] of [this.t0, this.t1, this.t2].entries()) {
			if (!tw) continue
			if (tw.term.type !== TermTypes.GENE_VARIANT) continue
			if (!this.geneVariant[`t${idx}value`]) continue
			const value = sample?.[tw.$id!]?.value
			if (value != this.geneVariant[`t${idx}value`]) {
				filterSample = true
			}
		}
		return filterSample
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
		} else if (tw.term.type === TermTypes.SURVIVAL) {
			/** Use key for term value, not value (value == time elapsed) */
			formattedVal = tw.term.values?.[sample.key]?.label || sample.key
		} else {
			formattedVal = tw.term.values?.[sample.value]?.label || sample.value
		}
		row.push({ value: formattedVal })
	}

	addColValue(tw: TermWrapper, columns: TableColumn[]): void {
		if (tw.term.type === TermTypes.GENE_VARIANT) {
			//This func mutates columns directly
			addGvCols(tw, columns)
		}
		/** Note: survival fails in termdbtest but not any other
		 * ds. Leaving commented out for now.*/
		// else if (tw.term.type === TermTypes.SURVIVAL) {
		// 	return
		// }
		else {
			columns.push({ label: tw.term.name })
		}
	}
}
