import { gettermsbyidsRequest, gettermsbyidsResponse } from '#shared/types/routes/termdb.termsbyids.js'
import { copy_term } from '#src/termdb.js'

export const api: any = {
	endpoint: 'termdb/termsbyids',
	methods: {
		get: {
			init,
			request: {
				typeId: 'gettermsbyidsRequest'
			},
			response: {
				typeId: 'gettermsbyidsResponse'
			}
		},
		post: {
			alternativeFor: 'get',
			init
		}
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		const q = req.query // as getcategoriesRequest
		try {
			const g = genomes[req.query.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets[req.query.dslabel]
			if (!ds) throw 'invalid dataset name'
			const tdb = ds.cohort.termdb
			if (!tdb) throw 'invalid termdb object'

			await trigger_gettermsbyid(q, res, tdb) // as getcategoriesResponse
		} catch (e) {
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			res.send({ error: e?.message || e })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}

async function trigger_gettermsbyid(
	q: { ids: any },
	res: { send: (arg0: { terms: any }) => void },
	tdb: { q: { termjsonByOneid: (arg0: any) => any } }
) {
	const terms = {}
	for (const id of q.ids) {
		const t = tdb.q.termjsonByOneid(id)
		terms[id] = t ? copy_term(t) : undefined
	}
	res.send({
		terms
	})
}
