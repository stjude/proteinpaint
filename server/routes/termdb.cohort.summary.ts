import { get_ds_tdb } from '#src/termdb.js'
import { mayCopyFromCookie } from '#src/utils.js' // ??? is this needed for this route ???

export const api: any = {
	endpoint: 'termdb/cohort/summary',
	methods: {
		get: {
			init,
			request: {
				typeId: 'any'
			},
			response: {
				typeId: 'any'
			}
		}
	}
}

function init({ genomes }) {
	return async (req, res) => {
		const q = req.query
		mayCopyFromCookie(q, req.cookies) // ??? is this needed for this route ???
		try {
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome'
			const [ds] = get_ds_tdb(genome, q)
			res.send({ count: ds.cohort.termdb.q.getCohortSampleCount(q.cohort) })
		} catch (e: any) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
			else console.log(e)
		}
	}
}
