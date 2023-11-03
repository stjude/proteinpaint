// import { gettermbyidRequest, gettermbyidResponse } from '#shared/types/routes/termdb.termbyid'
import { copy_term } from '#src/termdb.js'

export const api: any = {
	endpoint: 'termdb/termbyid',
	methods: {
		get: {
			init,
			request: {
				typeId: 'gettermbyidRequest'
			},
			response: {
				typeId: 'gettermbyidResponse'
			},
			examples: [
				{
					request: {
						body: {
							genome: 'hg38-test',
							dslabel: 'TermdbTest',
							embedder: 'localhost',
							gettermbyid: 'subcohort'
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
		const q = req.query // as getcategoriesRequest
		try {
			const g = genomes[req.query.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets[req.query.dslabel]
			if (!ds) throw 'invalid dataset name'
			const tdb = ds.cohort.termdb
			if (!tdb) throw 'invalid termdb object'

			await trigger_gettermbyid(q, res, tdb) // as getcategoriesResponse
		} catch (e) {
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			res.send({ error: e?.message || e })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}

async function trigger_gettermbyid(
	q: { gettermbyid: any },
	res: { send: (arg0: { term: any }) => void },
	tdb: { q: { termjsonByOneid: (arg0: any) => any } }
) {
	const t = tdb.q.termjsonByOneid(q.gettermbyid)
	res.send({
		term: t ? copy_term(t) : undefined
	})
}
