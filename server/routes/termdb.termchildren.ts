import type { TermChildrenRequest, TermChildrenResponse, RouteApi } from '#types'
import { termChildrenPayload } from '#types/checkers'
import { copy_term, get_ds_tdb } from '#src/termdb.js'

export const api: RouteApi = {
	endpoint: 'termdb/termchildren',
	methods: {
		get: {
			...termChildrenPayload,
			init
		},
		post: {
			...termChildrenPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		const q: TermChildrenRequest = req.query
		try {
			const g = genomes[req.query.genome]
			if (!g) throw 'invalid genome name'
			const [ds, tdb] = await get_ds_tdb(g, q)
			if (!ds) throw 'invalid dataset name'
			if (!tdb) throw 'invalid termdb object'
			const result: TermChildrenResponse = await trigger_children(q, tdb)
			res.send(result)
		} catch (e) {
			res.send({ error: e instanceof Error ? e.message : e })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}

async function trigger_children(
	q: {
		genome?: string
		dslabel?: string
		embedder?: string
		get_children?: number
		tid: any
		cohortValues?: any
		treeFilter?: any
	},
	tdb: { q: { getTermChildren: (arg0: any, arg1: any, arg2: any) => any } }
): Promise<TermChildrenResponse> {
	/* get children terms
may apply ssid: a premade sample set
*/
	if (!q.tid) throw 'no parent term id'
	const cohortValues = q.cohortValues ? q.cohortValues : ''
	const treeFilter = q.treeFilter ? q.treeFilter : ''
	const terms = await tdb.q.getTermChildren(q.tid, cohortValues, treeFilter)
	return { lst: terms.map(copy_term) }
}
