import type { AppApi } from '#rx'
import type { TermWrapper } from '#types'
import type { AnnotatedSampleData, AnnotatedSampleEntry } from '../../types/termdb'
import type { TableColumn, TableRow } from '#dom'
import { getSamplelstFilter } from '../../mass/groups.js'
import { TermTypes, isNumericTerm, roundValueAuto, isStrictNumeric } from '#shared'
import { filterJoin } from '#filter'
import { addGvRowVals, addGvCols } from '#plots/barchart.events.js'

/** Temp type scoped for this file.
 * Properties required in the plot arg. */
type ScopedPlot = {
	chartId?: string //value of divideBy term
	seriesId?: string //value of overlay term
	descrStats?: any //descriptive stats for the plot
	key: any //value of the plot itself
}

type ScopedBins = {
	[key: string]: {
		[key: string]: {
			start?: number
			stop?: number
			startinclusive?: boolean
			stopinclusive?: boolean
			startunbounded?: boolean
			stopunbounded?: boolean
			value?: string | number
			label?: string
		}
	}
}

/** Constructs the list sample argument needed for the server request.
 * Maybe used for showing the samples to user or creating filters. */
export class ListSamples {
	app: AppApi
	termfilter: any
	plot: ScopedPlot
	/** Created by the server */
	bins: ScopedBins

	t1: TermWrapper
	t2: TermWrapper
	t0?: TermWrapper
	terms: TermWrapper[]

	/** Indicates a reduced range than then bin (e.g. violin brush) */
	useRange: boolean
	start?: number | null
	end?: number | null

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

	constructor(
		app: AppApi,
		termfilter: any,
		config: any,
		plot: ScopedPlot,
		bins?: ScopedBins,
		start?: number | null | undefined,
		end?: number | null | undefined
	) {
		if (!config.term) {
			throw new Error('Missing term in plot config')
		}
		this.app = app
		this.termfilter = termfilter
		this.plot = plot
		this.bins = bins || {}
		this.useRange = false

		this.t1 = config.term
		this.t2 = config.term2
		this.t0 = config?.term0 || null

		this.terms = [this.t1]

		if ((isStrictNumeric(start) && !isStrictNumeric(end)) || (!isStrictNumeric(start) && isStrictNumeric(end))) {
			throw new Error('Both start and end must be provided for range filtering')
		}

		if (isStrictNumeric(start) && isStrictNumeric(end)) {
			this.useRange = true
			this.start = start
			this.end = end
		}

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
		const tw = this[`t${termNum}`]
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
		this.createTvsValues(tvsEntry, tw, key)
		return tvsEntry
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
			/** Continuous terms may not have bins defined
			 * but range property is required. */
			tvs.ranges = []
		}

		if (this.useRange) {
			/** May need to limit the range (e.g. violin brush) or add
			 * a range when no bins exist for the query to succeed. */
			if (tvs.ranges.length > 0 && tvs.ranges[0]?.start !== undefined) {
				tvs.ranges[0].start = this.start
				tvs.ranges[0].stop = this.end
			} else {
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
			if (e instanceof Error) throw e
			else {
				throw new Error(`Error fetching sample data: ${e.message || e}`)
			}
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
			const term1Sample = s[this.t1.$id!]
			if (term1Sample) {
				/** Forcing 'value' property because ts requires explicit property access
				 * that contradicts with the AnnotatedSampleEntry type definition.
				 * Both objs are correct in this case.
				 *
				 * If modifying this code, double check the types and usages.*/
				if (this.t1?.q?.hiddenValues && this.t1.q.hiddenValues?.[term1Sample?.['value']]) {
					continue //skip hidden values
				} else this.addRowValue(s, this.t1, row)
			} else continue //skip rows with no term value
			if (this.t2) {
				//See comment above about 'value' property
				const term2Sample = s[this.t2.$id!]
				if (this.t2?.q?.hiddenValues && this.t2?.q.hiddenValues[term2Sample?.['value']]) {
					continue
				}
				if (term2Sample) this.addRowValue(s, this.t2, row)
			}
			rows.push(row)
		}

		//Formatting columns
		const columns: TableColumn[] = [{ label: 'Sample' }]
		this.addColValue(this.t1, columns)
		if (this.t2) this.addColValue(this.t2, columns)

		return [rows, columns]
	}

	mayFilterGVSample(sample: AnnotatedSampleEntry): boolean {
		let filterSample = false
		for (const [idx, tw] of [this.t0, this.t1, this.t2].entries()) {
			if (!tw) continue
			if (tw.term.type !== TermTypes.GENE_VARIANT) continue
			if (!this.geneVariant[`t${idx}value`]) continue
			/** See comment in setTableData() about 'value' property */
			const value = sample?.[tw.$id!]?.['value']
			if (value != this.geneVariant[`t${idx}value`]) {
				filterSample = true
				break
			}
		}
		return filterSample
	}

	addRowValue(s: any, tw: TermWrapper, row: TableRow): void {
		if (tw.term.type === TermTypes.GENE_VARIANT) {
			//This func mutates row directly
			addGvRowVals(s, tw, row, this.app.vocabApi.termdbMatrixClass)
			return
		}

		const sample = s[tw.$id!]
		let formattedVal
		if (isNumericTerm(tw.term)) {
			formattedVal = roundValueAuto(sample.value)
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
		} else {
			columns.push({ label: tw.term.name })
		}
	}
}
