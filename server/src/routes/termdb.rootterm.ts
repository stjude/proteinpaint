import type { RouteApi, RoutePayload, RootTermRequest, RootTermResponse } from '#types'
import { get_ds_tdb } from '#src/termdb.js'

export const payload: RoutePayload = {
	init,
	request: { typeId: 'RootTermRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'RootTermResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/rootterm',
	methods: {
		get: payload,
		post: payload
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		const q: RootTermRequest = req.query
		//const cohortValues = q.cohortValues ? q.cohortValues : ''
		//const treeFilter = q.treeFilter ? q.treeFilter : ''
		//res.send({ lst: await tdb.q.getRootTerms(cohortValues, treeFilter) })

		try {
			const g = genomes[req.query.genome]
			if (!g) throw 'invalid genome name'

			const [ds, tdb] = get_ds_tdb(g, q)
			if (!ds) throw 'invalid dataset name'
			if (!tdb) throw 'invalid termdb object'

			await trigger_rootterm(req, q, res, tdb) // as getroottermResponse
		} catch (e) {
			res.send({ error: e instanceof Error ? e.message : e })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}

async function trigger_rootterm(
	req: any,
	q: { cohortValues: any; treeFilter: any },
	res: { send: (arg0: { lst: any }) => void },
	tdb: { q: { getRootTerms: (req: any, arg0: any, arg1: any) => any } }
) {
	const cohortValues = q.cohortValues ? q.cohortValues : ''
	const treeFilter = q.treeFilter ? q.treeFilter : ''
	res.send({ lst: await tdb.q.getRootTerms(req, cohortValues, treeFilter) } satisfies RootTermResponse)
}
