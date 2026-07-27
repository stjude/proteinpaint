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
		const twLst: Array<{ term: any; q: any }> = []
		for (const i of [0, 1, 2]) {
			const termnum = 'term' + i
			const termnum_id = termnum + '_id'
			if (typeof q[termnum_id] == 'string') {
				q[termnum_id] = decodeURIComponent(q[termnum_id])
				q[termnum] = q.ds.cohort.termdb.q.termjsonByOneid(q[termnum_id])
			} else if (typeof q[termnum] == 'string') {
				q[termnum] = JSON.parse(decodeURIComponent(q[termnum]))
			}

			const termnum_q = termnum + '_q'

			if (q[termnum]) twLst.push({ term: q[termnum], q: q[termnum_q] })
		}

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
		const st = q[`term${survTermIndex}`]
		const ot = q[`term${survTermIndex == 1 ? 2 : 1}`]
		const dt = q.term0

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

		const byChartSeries: Record<string, Array<{ time: number; status: number; series: string }>> = {}
		const keys = { chart: new Set<string>(), series: new Set<string>() }
		for (const d of results) {
			const s = d[st.id]
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
		const orderedLabels = getOrderedLabels(q.term2, bins ? bins.map(bin => (bin.name ? bin.name : bin.label)) : [])
		const orderedLabelsTerm0 = getOrderedLabels(q.term0)
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

function getSurvTermIndex(q: any) {
	if (q.term1) {
		if (q.term1.type == 'survival') return 1
	}
	if (!q.term2) throw 'term1.type is not survival and term2 is missing'
	if (q.term2.type != 'survival') throw 'both term1 and term2 are not survival type'
	return 2
}

function getSampleArray(data: any, st: any) {
	const lst = Object.values(data.samples as Record<string, any>).filter((i: any) => i[st.id])
	return lst.sort((a: any, b: any) => (a[st.id].value < b[st.id].value ? -1 : 1))
}

function getTermData(d: any, t: any) {
	let data
	if (Object.prototype.hasOwnProperty.call(t, 'id')) {
		if (!Object.prototype.hasOwnProperty.call(d, t.id)) return
		data = d[t.id].key
	} else if (t.type == 'samplelst') {
		if (!Object.prototype.hasOwnProperty.call(d, t.name)) return
		data = d[t.name].key
	} else {
		const n = t.name
		if (t.type == TermTypes.GENE_EXPRESSION) {
			data = d[t.name]?.key || 'Missing data'
		} else if (d[t.name]) {
			data = d[t.name].key
		} else {
			throw `cannot get key for term='${n}'`
		}
	}
	return data
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
