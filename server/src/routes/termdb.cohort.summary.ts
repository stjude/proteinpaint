import type { TermdbCohortSummaryRequest, TermdbCohortSummaryResponse, RouteApi, RoutePayload } from '#types'
import { get_ds_tdb } from '#src/termdb.js'
import { get_samples } from '#src/termdb.sql.js'
import { authApi } from '#src/auth.js'

const payload: RoutePayload = {
	init,
	request: { typeId: 'TermdbCohortSummaryRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'TermdbCohortSummaryResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/cohort/summary',
	methods: {
		get: payload
	}
}

function init({ genomes }) {
	return async (req, res) => {
		const q: TermdbCohortSummaryRequest = req.query
		try {
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome'
			const [ds] = get_ds_tdb(genome, q)
			// !!! CRITICAL !!!
			// - must always call authApi.mayAdjustFilter(), dataset-specific logic exceptions
			// must be coded inside a ds.cohort.termdb.getAdditionalFilter() option;
			// - we dont include terms (3rd argument) to ensure that no additional filter is applied
			// and we count all the samples (the response is aggregated)
			authApi.mayAdjustFilter(req.query, ds, [])
			//the response is aggregated, no identifiable information is included
			//only if a filter is applied always request samples(panMB dataset). Profile and carereg have getAdditionalFilter but the samples are only filtered where needed
			//This avoids requesting samples for the sjglobal datasets
			let count
			if (q.filter?.lst?.length) {
				const samples = await get_samples(q, ds)
				count = samples.length
				if (count && ds.cohort.termdb?.hasSampleAncestry) {
					/* the ds has typed samples (e.g. patient-sample hierarchy): break the
					filtered count down by type, in the same format as getCohortSampleCount().
					filtered ids are annotated (child) samples; their distinct ancestors
					(e.g. patients) are counted from sample_ancestry */
					try {
						const idsJson = JSON.stringify(samples.map(s => s.id))
						const cn = ds.cohort.db.connection
						const byType = new Map() // k: sample_type id, v: count
						for (const r of cn
							.prepare(
								`SELECT sample_type, count(*) AS n FROM sampleidmap
								WHERE id IN (SELECT value FROM json_each(?)) GROUP BY sample_type`
							)
							.all(idsJson) as any[]) {
							byType.set(r.sample_type, (byType.get(r.sample_type) || 0) + r.n)
						}
						for (const r of cn
							.prepare(
								`SELECT sm.sample_type, count(DISTINCT sa.ancestor_id) AS n
								FROM sample_ancestry sa
								JOIN sampleidmap sm ON sm.id = sa.ancestor_id
								WHERE sa.sample_id IN (SELECT value FROM json_each(?))
								GROUP BY sm.sample_type`
							)
							.all(idsJson) as any[]) {
							byType.set(r.sample_type, (byType.get(r.sample_type) || 0) + r.n)
						}
						const parts = [...byType.entries()]
							.sort((a, b) => a[0] - b[0])
							.map(([typeId, n]) => {
								const sampleType = ds.cohort.termdb.sampleTypes[typeId]
								if (!sampleType) throw `unknown sample_type ${typeId}`
								return `${n} ${n > 1 ? sampleType.plural_name : sampleType.name}`
							})
						if (parts.length) count = parts.join(' and ')
					} catch (e) {
						// fall back to the flat sample count rather than failing the About display
						console.log('cohort summary by-type count failed:', e)
					}
				}
			} else {
				// getter is absent on non-db based ds (gdc, mmrf), and returns '' on a db ds when no
				// cohort row matches q.cohort. return a placeholder rather than a fabricated number,
				// as this is rendered as-is in the mass nav ABOUT tab. same treatment at
				// get_samplecount() of termdb.sql.js
				count = ds.cohort.termdb.q?.getCohortSampleCount?.(q.cohort) || 'n/a'
			}
			res.send({ count } satisfies TermdbCohortSummaryResponse)
		} catch (e: any) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
			else console.log(e)
		}
	}
}
