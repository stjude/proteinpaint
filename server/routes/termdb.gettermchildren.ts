import type { gettermchildrenRequest, gettermchildrenResponse } from '#routeTypes/termdb.gettermchildren.ts'
import { copy_term, get_ds_tdb } from '#src/termdb.js'

export const api: any = {
	endpoint: 'termdb/termchildren',
	methods: {
		get: {
			init,
			request: {
				typeId: 'gettermchildrenRequest'
			},
			response: {
				typeId: 'gettermchildrenResponse'
			},
			examples: [
				{
					request: {
						body: {
							genome: 'hg38-test',
							dslabel: 'TermdbTest',
							embedder: 'localhost',
							get_children: 1,
							cohortValues: 'ABC',
							tid: 'GO:0000001'
						}
					},
					response: {
						header: { status: 200 }
					}
				}
			]
		},
		post: {
			alternativeFor: 'get',
			init
		}
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		const q = req.query as gettermchildrenRequest
		try {
			const g = genomes[req.query.genome]
			if (!g) throw 'invalid genome name'
			const [ds, tdb] = await get_ds_tdb(g, q)
			if (!ds) throw 'invalid dataset name'
			if (!tdb) throw 'invalid termdb object'

			await trigger_children(q, res, tdb)
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
	res: { send: (arg0: gettermchildrenResponse) => void },
	tdb: { q: { getTermChildren: (arg0: any, arg1: any, arg2: any) => any } }
) {
	/* get children terms
may apply ssid: a premade sample set
*/
	if (!q.tid) throw 'no parent term id'
	const cohortValues = q.cohortValues ? q.cohortValues : ''
	const treeFilter = q.treeFilter ? q.treeFilter : ''
	const terms = await tdb.q.getTermChildren(q.tid, cohortValues, treeFilter)
	res.send({ lst: terms.map(copy_term) } as gettermchildrenResponse)
}
