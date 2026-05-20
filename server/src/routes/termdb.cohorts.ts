import type { TermdbCohortsRequest, TermdbCohortsResponse, RouteApi, RoutePayload } from '#types'
import { get_ds_tdb } from '#src/termdb.js'

const payload: RoutePayload = {
	init,
	request: { typeId: 'TermdbCohortsRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'TermdbCohortsResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/cohorts',
	methods: {
		get: payload
	}
}

export function init({ genomes }) {
	return async (req, res) => {
		const q: TermdbCohortsRequest = req.query
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
	if (!ds.cohort.db) return { cohorts: [], features: [], cfeatures: [] }
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
