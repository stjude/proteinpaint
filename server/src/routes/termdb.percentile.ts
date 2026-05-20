import type { PercentileRequest, PercentileResponse, RouteApi } from '#types'
import { percentilePayload } from '#types/checkers'
import { isNumericTerm } from '#shared/terms.js'
import { getData } from '#src/termdb.matrix.js'
import computePercentile from '#shared/compute.percentile.js'

export const api: RouteApi = {
	endpoint: 'termdb/getpercentile',
	methods: {
		get: {
			...percentilePayload,
			init
		},
		post: {
			...percentilePayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		const q: PercentileRequest = req.query
		try {
			const g = genomes[req.query.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets[req.query.dslabel]
			if (!ds) throw 'invalid dataset name'
			await trigger_getpercentile(q, res, ds) // as getpercentileResponse
		} catch (e) {
			res.send({ error: e instanceof Error ? e.message : e })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}

async function trigger_getpercentile(q, res, ds) {
	const term = q.term
	if (!term) throw 'term is missing'
	if (!isNumericTerm(term)) throw 'not numeric term'
	const tw = { $id: '_', term, q: { mode: 'continuous' } }
	const data = await getData({ filter: q.filter, filter0: q.filter0, terms: [tw], __protected__: q.__protected__ }, ds)
	if (data.error) throw data.error
	const values: number[] = []
	for (const key in data.samples) {
		const sample = data.samples[key]
		const v = sample[tw.$id]
		if (!v?.value) {
			// skip undefined values
			continue
		}
		const value = v.value
		if (term.values && term.values[value] && term.values[value].uncomputable) {
			// skip uncomputable values
			continue
		}
		if (term.skip0forPercentile && value == 0) {
			// quick fix: when the flag is true, will exclude 0 values from percentile computing
			// to address an issue with computing knots
			continue
		}
		values.push(Number(value))
	}
	// compute percentiles
	const percentile_lst = q.getpercentile
	const perc_values: number[] = []
	for (const percentile of percentile_lst) {
		const perc_value = computePercentile(values, percentile)
		perc_values.push(perc_value)
	}
	res.send({ values: perc_values } satisfies PercentileResponse)
}
