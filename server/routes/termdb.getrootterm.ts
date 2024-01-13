import { getroottermRequest, getroottermResponse } from '#shared/types/routes/termdb.getrootterm.ts'
import { get_ds_tdb } from '#src/termdb.js'

export const api: any = {
	endpoint: 'termdb/rootterm',
	methods: {
		get: {
			init,
			request: {
				typeId: 'getroottermRequest'
			},
			response: {
				typeId: 'getroottermResponse'
			},
			examples: [
				{
					request: {
						body: {
							genome: 'hg38-test',
							dslabel: 'TermdbTest',
							embedder: 'localhost',
							default_rootterm: 1,
							cohortValues: 'ABC'
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
		const q = req.query as getroottermRequest
		try {
			const g = genomes[req.query.genome]
			if (!g) throw 'invalid genome name'
			const [ds, tdb] = await get_ds_tdb(g, q)
			if (!ds) throw 'invalid dataset name'
			if (!tdb) throw 'invalid termdb object'

			await trigger_rootterm(q, res, tdb) // as getroottermResponse
		} catch (e) {
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			res.send({ error: e?.message || e })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}

async function trigger_rootterm(
	q: { cohortValues: any; treeFilter: any },
	res: { send: (arg0: { lst: any }) => void },
	tdb: { q: { getRootTerms: (arg0: any, arg1: any) => any } }
) {
	const cohortValues = q.cohortValues ? q.cohortValues : ''
	const treeFilter = q.treeFilter ? q.treeFilter : ''
	res.send({ lst: await tdb.q.getRootTerms(cohortValues, treeFilter) } as getroottermResponse)
}
