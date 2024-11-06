import type { PercentileRequest, PercentileResponse, Filter, RouteApi } from '#types'
import { percentilePayload } from '#types'
import * as termdbsql from '#src/termdb.sql.js'
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

async function trigger_getpercentile(
	q: { tid: string; getpercentile: number[]; filter: Filter },
	res: { send: (arg0: { values: number[] }) => void },
	ds: { cohort: { termdb: { q: { termjsonByOneid: (arg0: any) => any } } } }
) {
	const term = ds.cohort.termdb.q.termjsonByOneid(q.tid)
	if (!term) throw 'invalid termid'
	if (term.type != 'float' && term.type != 'integer') throw 'not numerical term'
	const percentile_lst = q.getpercentile
	const perc_values = [] as number[]
	const values = [] as number[]
	const rows = await termdbsql.get_rows_by_one_key({
		ds,
		key: q.tid,
		filter: q.filter ? (typeof q.filter == 'string' ? JSON.parse(q.filter) : q.filter) : null
	})
	for (const { value } of rows) {
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
	for (const percentile of percentile_lst) {
		const perc_value = computePercentile(values, percentile)
		perc_values.push(perc_value)
	}
	res.send({ values: perc_values } satisfies PercentileResponse)
}
