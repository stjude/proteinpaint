import { getData } from '#src/termdb.matrix.js'
import { getTwByIndex, getTwBins } from '#src/termdb.twFromRequest.ts'
import { run_R } from '@sjcrh/proteinpaint-r'
import { TermTypes } from '#types'
import type { RouteApi, RoutePayload } from '#types'

const payload: RoutePayload = {
	init,
	request: { typeId: 'TermdbSurvivalRequest' },
	response: { typeId: 'TermdbSurvivalResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/survival',
	methods: {
		get: payload,
		post: payload
	}
}

export async function get_survival(q: any, ds: any) {
	try {
		if (!ds.cohort) throw 'cohort missing from ds'
		q.ds = ds
		const twByIndex = getTwByIndex(q)
		const twLst = [...twByIndex.values()]

		const tw1 = twByIndex.get(1)
		const tw2 = twByIndex.get(2)
		if (!tw1) throw `term1 is missing`
		if (tw2) {
			if (tw2.term.type == 'survival' && tw1.term.type == 'survival') {
				throw `term and overlay are both survival terms - only one could be a survival term`
			}
			if (tw2.term.type != 'survival' && tw1.term.type != 'survival') {
				throw `no survival terms, either the main term OR the overlay term must be a survival term`
			}
		} else if (tw1.term.type != 'survival') {
			throw `non-survival term`
		}
		if (twByIndex.get(0)?.term.type == 'survival') {
			throw `term0 must not be a survival term`
		}

		const survTermIndex = getSurvTermIndex(tw1, tw2) // 1 or 2
		// st, ot and dt are term wrappers, not terms
		const st = twByIndex.get(survTermIndex)
		const ot = twByIndex.get(survTermIndex == 1 ? 2 : 1)
		const dt = twByIndex.get(0)
		mayValidateStratificationTw(ot)
		mayValidateStratificationTw(dt)

		if (dt || ot) {
			const restrict = ds.cohort.termdb.restrictSurvivalStratification?.(q.__protected__)
			if (restrict) {
				throw typeof restrict == 'string'
					? restrict
					: 'Survival stratification (divide-by and overlay) is not available for this view'
			}
		}
		const data = await getData(
			{
				terms: twLst,
				filter: q.filter,
				filter0: q.filter0,
				__protected__: q.__protected__,
				__abortSignal: q.__abortSignal
			},
			ds
		)
		if (data.error) throw data.error
		const results = getSampleArray(data, st)

		const stKey = st.$id
		const byChartSeries: Record<string, Array<{ time: number; status: number; series: string }>> = {}
		const keys = { chart: new Set<string>(), series: new Set<string>() }
		for (const d of results) {
			const s = d[stKey]
			const time = s.value
			if (time < 0) continue
			const status = s.key

			let series: any
			if (ot) {
				series = getTermData(d, ot)
				if (!series && series !== 0) continue
			} else {
				series = '*'
			}
			keys.series.add(series)

			let chart: any
			if (dt) {
				chart = getTermData(d, dt)
				if (!chart && chart !== 0) continue
			} else {
				chart = ''
			}

			if (!Object.prototype.hasOwnProperty.call(byChartSeries, chart)) {
				byChartSeries[chart] = []
				keys.chart.add(chart)
			}
			byChartSeries[chart].push({ time, status, series })
		}

		const final_data: any = {
			keys: ['chartId', 'seriesId', 'time', 'survival', 'lower', 'upper', 'nevent', 'ncensor', 'nrisk'],
			case: [],
			refs: {
				/* the survival plot reads refs.bins as a flat list of the overlay term's bins
				(renderPvalues, sortSerieses) while the shared syncTermData() reads it as a list
				indexed by term number, so sending computed bins here would corrupt the plot config.
				This has always been empty in practice: the lookup that filled it read data.refs.q,
				which getData() does not return. Key order is supplied by orderedKeys below. */
				bins: [],
				byTermId: data.refs.byTermId
			}
		}

		for (const chartId in byChartSeries) {
			const chartData = byChartSeries[chartId]
			const survival_data = JSON.parse(await run_R('survival.R', JSON.stringify(chartData)))
			for (const obj of survival_data.estimates) {
				for (const key in obj) {
					if (key == 'series') {
						obj[key] = obj[key] == '*' ? '' : obj[key]
					} else {
						obj[key] = Number(obj[key])
					}
				}
				final_data.case.push([
					chartId,
					obj.series,
					obj.time,
					obj.surv,
					obj.lower,
					obj.upper,
					obj.nevent,
					obj.ncensor,
					obj.nrisk
				])
			}

			if (survival_data.tests) {
				if (!final_data.tests) final_data.tests = {}
				final_data.tests[chartId] = survival_data.tests
			}
		}
		final_data.case.sort((a, b) => a[2] - b[2])
		const orderedLabels = getOrderedLabels(ot?.term, getTwBins(ot, data))
		const orderedLabelsTerm0 = getOrderedLabels(dt?.term, getTwBins(dt, data))
		final_data.refs.orderedKeys = {
			chart: [...keys.chart].sort(
				!orderedLabelsTerm0 ? undefined : (a, b) => orderedLabelsTerm0.indexOf(a) - orderedLabelsTerm0.indexOf(b)
			),
			series: [...keys.series].sort(
				!orderedLabels ? undefined : (a, b) => orderedLabels.indexOf(a) - orderedLabels.indexOf(b)
			)
		}
		return final_data
	} catch (e: any) {
		if (e?.stack) console.log(e.stack)
		return { error: e.message || e }
	}
}

function init({ genomes }: any) {
	return async (req: any, res: any) => {
		try {
			const q = req.query
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome'
			const ds = genome.datasets?.[q.dslabel] || genome.termdbs?.[q.dslabel]
			if (!ds) throw 'invalid dslabel'
			const data = await get_survival(q, ds)
			res.send(data)
		} catch (e: any) {
			res.send({ error: e.message || e })
			if (e?.stack) console.log(e.stack)
			else console.log(e)
		}
	}
}

/** a fraction resolves to one number per sample, it must be binned to be usable
 *  as an overlay or divide-by term */
function mayValidateStratificationTw(tw: any) {
	if (tw?.type == 'TermCollectionTWFraction' && tw.q?.mode != 'discrete')
		throw `${tw.term.name} fraction must use discrete bins to serve as an overlay or divide-by term`
}

function getSurvTermIndex(tw1: any, tw2: any) {
	if (tw1.term.type == 'survival') return 1
	if (!tw2) throw 'term1.type is not survival and term2 is missing'
	if (tw2.term.type != 'survival') throw 'both term1 and term2 are not survival type'
	return 2
}

function getSampleArray(data: any, st: any) {
	const key = st.$id
	const lst = Object.values(data.samples as Record<string, any>).filter((i: any) => i[key])
	return lst.sort((a: any, b: any) => (a[key].value < b[key].value ? -1 : 1))
}

/** getData() keys every sample's annotation by tw.$id, so one lookup covers all term
 *  types. Returns undefined when a sample has no value for the term, which the caller
 *  skips. */
export function getTermData(d: any, tw: any) {
	const v = d[tw.$id]
	if (tw.term.type == TermTypes.GENE_EXPRESSION) {
		// a sample may have survival data but no expression value: keep it as its own series
		return v?.key || 'Missing data'
	}
	return v?.key
}

/** the order of the series or chart keys supplied by a stratification term: the labels of
 *  the bins that getData() computed for it, else its value keys */
function getOrderedLabels(term: any, bins: any[] = []) {
	if (term?.type == 'condition' && term.values) {
		return Object.keys(term.values)
			.map(Number)
			.sort((a, b) => a - b)
			.map(i => term.values[i].label)
	}
	/* a binned term supplies bin labels as keys, so its bins must be read before term.values,
	which for such a term is either empty or holds only uncomputable values */
	if (bins.length) return bins.map(bin => (bin.name ? bin.name : bin.label))
	if (term?.values) {
		return Object.keys(term.values).sort((a, b) =>
			'order' in term.values[a] && 'order' in term.values[b] ? term.values[a].order - term.values[b].order : 0
		)
	}
	return []
}
