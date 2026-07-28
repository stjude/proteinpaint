import { getData } from '#src/termdb.matrix.js'
import { run_R } from '@sjcrh/proteinpaint-r'
import { TermTypes } from '#shared/terms.js'
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

		if (q.term2) {
			if (q.term2.type == 'survival' && q.term1.type == 'survival') {
				throw `term and overlay are both survival terms - only one could be a survival term`
			}
			if (q.term2.type != 'survival' && q.term1.type != 'survival') {
				throw `no survival terms, either the main term OR the overlay term must be a survival term`
			}
		} else if (q.term1.type != 'survival') {
			throw `non-survival term`
		}
		if (q.term0 && q.term0.type == 'survival') {
			throw `term0 must not be a survival term`
		}

		const survTermIndex = getSurvTermIndex(q) // 1 or 2
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

		const bins = (q.term2_id && data.refs.q?.[q.term2.id]?.bins) || data.refs?.[q.term2?.id]?.bins || []
		const final_data: any = {
			keys: ['chartId', 'seriesId', 'time', 'survival', 'lower', 'upper', 'nevent', 'ncensor', 'nrisk'],
			case: [],
			refs: {
				bins,
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
		const orderedLabels = getOrderedLabels(ot?.term, bins.length ? bins : getFractionBins(ot, data))
		const orderedLabelsTerm0 = getOrderedLabels(dt?.term, getFractionBins(dt, data))
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

/** Reconstruct the term wrappers encoded by the term0/term1/term2 request parameters.
 *  q.term0, q.term1 and q.term2 are filled in as a side effect, since get_survival()
 *  validates the request by term type. */
export function getTwByIndex(q: any) {
	const twByIndex = new Map<number, any>()
	for (const i of [0, 1, 2]) {
		const termnum = 'term' + i
		const termnum_id = termnum + '_id'
		if (typeof q[termnum_id] == 'string') {
			q[termnum_id] = decodeURIComponent(q[termnum_id])
			q[termnum] = q.ds.cohort.termdb.q.termjsonByOneid(q[termnum_id])
		} else if (typeof q[termnum] == 'string') {
			q[termnum] = JSON.parse(decodeURIComponent(q[termnum]))
		}
		if (!q[termnum]) continue

		const tw: any = { term: q[termnum], q: q[termnum + '_q'] }
		const twType = q[termnum + '_type'] || inferTwType(tw)
		if (twType) tw.type = twType
		/* getData() keys each sample's data by tw.$id, backfilling it from term.id/name when
		absent; assign it here instead, so the key is a property of the tw this route built and
		not a side effect of getData(). Only a custom termCollection uses the client's $id,
		since it has no term.id; other term types stay keyed by term.id or term.name, which
		the client and the refs lookups below still assume. */
		tw.$id = (tw.term.type == 'termCollection' && q[termnum + '_$id']) || tw.term.id || tw.term.name
		twByIndex.set(i, tw)
	}
	return twByIndex
}

/** the tw type may be missing when a request is not assembled by the client tw router */
function inferTwType(tw: any) {
	if (tw.term?.type == 'termCollection' && Array.isArray(tw.q?.denominators)) return 'TermCollectionTWFraction'
	return undefined
}

/** a fraction termCollection has no term.values to order its keys by: its keys are the
 *  labels of the bins that getData() computed for it */
function getFractionBins(tw: any, data: any) {
	if (tw?.type != 'TermCollectionTWFraction') return []
	return data.refs.byTermId?.[tw.$id]?.bins || []
}

/** a fraction resolves to one number per sample, it must be binned to be usable
 *  as an overlay or divide-by term */
function mayValidateStratificationTw(tw: any) {
	if (tw?.type == 'TermCollectionTWFraction' && tw.q?.mode != 'discrete')
		throw `${tw.term.name} fraction must use discrete bins to serve as an overlay or divide-by term`
}

function getSurvTermIndex(q: any) {
	if (q.term1) {
		if (q.term1.type == 'survival') return 1
	}
	if (!q.term2) throw 'term1.type is not survival and term2 is missing'
	if (q.term2.type != 'survival') throw 'both term1 and term2 are not survival type'
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

function getOrderedLabels(term: any, bins: any[] = []) {
	if (term) {
		if (term.type == 'condition' && term.values) {
			return Object.keys(term.values)
				.map(Number)
				.sort((a, b) => a - b)
				.map(i => term.values[i].label)
		}
		if (term.values) {
			return Object.keys(term.values).sort((a, b) =>
				'order' in term.values[a] && 'order' in term.values[b] ? term.values[a].order - term.values[b].order : 0
			)
		}
	}
	return bins.map(bin => (bin.name ? bin.name : bin.label))
}
