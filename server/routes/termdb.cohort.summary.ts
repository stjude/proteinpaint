import type { TermdbCohortSummaryRequest, TermdbCohortSummaryResponse, RouteApi } from '#types'
import { termdbCohortSummaryPayload } from '#types/checkers'
import { get_ds_tdb } from '#src/termdb.js'
import { mayCopyFromCookie } from '#src/utils.js' // ??? is this needed for this route ???
import { get_samples } from '#src/termdb.sql.js'
import { authApi } from '#src/auth.js'
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
			authApi.mayAdjustFilter(req.query, ds, []) //we dont include terms to ensure that no additional filter is applied and we count all the samples
			//the response is aggregated, no identifiable information is included
			//only if a filter is applied always request samples(panMB dataset). Profile and sjcares have getAdditionalFilter but the samples are only filtered where needed
			//This avoids requesting samples for the sjglobal datasets
			let count
			if (q.filter?.lst?.length) {
				const samples = await get_samples(q, ds)
				count = samples.length
			} else count = ds.cohort.termdb.q?.getCohortSampleCount?.(q.cohort) || 1
			res.send({ count } satisfies TermdbCohortSummaryResponse)
		} catch (e: any) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
			else console.log(e)
		}
	}
}
