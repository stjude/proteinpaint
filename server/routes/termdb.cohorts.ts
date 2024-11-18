import type { TermdbCohortsRequest, TermdbCohortsResponse, RouteApi } from '#types'
import { termdbCohortsPayload } from '#types/checkers'
import { get_ds_tdb } from '#src/termdb.js'
import { mayCopyFromCookie } from '#src/utils.js' // ??? is this needed for this route ???

export const api: RouteApi = {
	endpoint: 'termdb/cohorts',
	methods: {
		get: {
			...termdbCohortsPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req, res) => {
		const q: TermdbCohortsRequest = req.query
		mayCopyFromCookie(q, req.cookies) // ??? is this needed for this route ???
		try {
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome'

			const [ds] = get_ds_tdb(genome, q)
			const result: TermdbCohortsResponse = getCohortsData(ds)
			res.send(result)
		} catch (e: any) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
			else console.log(e)
		}
	}
}

export function getCohortsData(ds) {
	const features = ds.cohort.db.connection.prepare('select * from features').all()
	const cohorts = ds.cohort.db.connection
		.prepare(
			`select * from cohorts where cohort in (select distinct(cohort) from cohort_features)
		 order by sample_count desc`
		)
		.all()
	const cfeatures = ds.cohort.db.connection.prepare('select * from cohort_features').all()

	return { cohorts, features, cfeatures }
}
