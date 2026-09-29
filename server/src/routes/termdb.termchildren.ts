import type { TermChildrenRequest, TermChildrenResponse, RouteApi, RoutePayload } from '#types'
import { copy_term, get_ds_tdb } from '#src/termdb.js'

export const payload: RoutePayload = {
	init,
	request: { typeId: 'TermChildrenRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'TermChildrenResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/termchildren',
	methods: {
		get: payload,
		post: payload
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
			const result: TermChildrenResponse = await trigger_children(req, q, tdb)
			res.send(result)
		} catch (e) {
			res.send({ error: e instanceof Error ? e.message : e })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}

async function trigger_children(
	req: any,
	q: TermChildrenRequest,
	tdb: {
		q: {
			getRootTerms: (req: any, cohortValues: string, treeFilter: string) => any
			getTermChildren: (req: any, tid: string, cohortValues: string, treeFilter: string) => any
		}
	}
): Promise<TermChildrenResponse> {
	/* get children terms of q.tid, or the root terms when q.tid is missing */
	const cohortValues = q.cohortValues || ''
	const treeFilter = q.treeFilter || ''
	const terms = q.tid
		? await tdb.q.getTermChildren(req, q.tid, cohortValues, treeFilter)
		: await tdb.q.getRootTerms(req, cohortValues, treeFilter)
	return { lst: terms.map(copy_term) }
}
