import type { TermdbCohortSummaryRequest, TermdbCohortSummaryResponse, RouteApi } from '#types'
import { termdbCohortSummaryPayload } from '#types'
import { get_ds_tdb } from '#src/termdb.js'
import { mayCopyFromCookie } from '#src/utils.js' // ??? is this needed for this route ???

export const api: RouteApi = {
	endpoint: 'termdb/cohort/summary',
	methods: {
		get: {
			...termdbCohortSummaryPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req, res) => {
		const q: TermdbCohortSummaryRequest = req.query
		mayCopyFromCookie(q, req.cookies) // ??? is this needed for this route ???
		try {
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome'
			const [ds] = get_ds_tdb(genome, q)
			const count = ds.cohort.termdb.q.getCohortSampleCount(q.cohort)
			res.send({ count } satisfies TermdbCohortSummaryResponse)
		} catch (e: any) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
			else console.log(e)
		}
	}
}
