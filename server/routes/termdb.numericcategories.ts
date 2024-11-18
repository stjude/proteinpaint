import type { NumericCategoriesRequest, NumericCategoriesResponse, RouteApi } from '#types'
import { numericCategoriesPayload } from '#types/checkers'
import * as termdbsql from '#src/termdb.sql.js'

export const api: RouteApi = {
	endpoint: 'termdb/numericcategories',
	methods: {
		get: {
			...numericCategoriesPayload,
			init
		},
		post: {
			...numericCategoriesPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		const q: NumericCategoriesRequest = req.query
		try {
			const g = genomes[req.query.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets[req.query.dslabel]
			if (!ds) throw 'invalid dataset name'
			const tdb = ds.cohort.termdb
			if (!tdb) throw 'invalid termdb object'

			const result = await trigger_getnumericcategories(q, tdb, ds) // as getnumericcategoriesResponse
			res.send(result)
		} catch (e) {
			res.send({ error: e instanceof Error ? e.message : e })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}

async function trigger_getnumericcategories(
	q: { tid: any; filter?: any },
	tdb: { q: { termjsonByOneid: (arg0: any) => any } },
	ds: any
): Promise<NumericCategoriesResponse> {
	if (!q.tid) throw '.tid missing'
	const arg = {
		ds,
		term_id: q.tid,
		filter: q.filter
	}
	const lst = await termdbsql.get_summary_numericcategories(arg)
	return { lst }
}
