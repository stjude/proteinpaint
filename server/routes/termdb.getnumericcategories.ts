import {
	getnumericcategoriesRequest,
	getnumericcategoriesResponse
} from '#shared/types/routes/termdb.getnumericcategories.ts'
import * as termdbsql from '#src/termdb.sql.js'

export const api: any = {
	endpoint: 'termdb/numericcategories',
	methods: {
		get: {
			init,
			request: {
				typeId: 'getnumericcategoriesRequest'
			},
			response: {
				typeId: 'getnumericcategoriesResponse'
			},
			examples: [
				{
					request: {
						body: {
							genome: 'hg38-test',
							dslabel: 'TermdbTest',
							embedder: 'localhost',
							tid: 'aaclassic_5',
							filter: {
								type: 'tvslst',
								in: true,
								join: '',
								lst: [
									{
										tag: 'cohortFilter',
										type: 'tvs',
										tvs: {
											term: {
												name: 'Cohort',
												type: 'categorical',
												values: { ABC: { label: 'ABC' }, XYZ: { label: 'XYZ' } },
												id: 'subcohort',
												isleaf: false,
												groupsetting: { disabled: true }
											},
											values: [{ key: 'ABC', label: 'ABC' }]
										}
									}
								]
							}
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
		const q = req.query as getnumericcategoriesRequest
		try {
			const g = genomes[req.query.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets[req.query.dslabel]
			if (!ds) throw 'invalid dataset name'
			const tdb = ds.cohort.termdb
			if (!tdb) throw 'invalid termdb object'

			await trigger_getnumericcategories(q, res, tdb, ds) // as getnumericcategoriesResponse
		} catch (e) {
			res.send({ error: e instanceof Error ? e.message : e })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}

async function trigger_getnumericcategories(
	q: { tid: any; filter?: any },
	res: { send: (arg0: { lst: any }) => void },
	tdb: { q: { termjsonByOneid: (arg0: any) => any } },
	ds: any
) {
	if (!q.tid) throw '.tid missing'
	const arg = {
		ds,
		term_id: q.tid,
		filter: q.filter
	}
	const lst = await termdbsql.get_summary_numericcategories(arg)
	res.send({ lst } as getnumericcategoriesResponse)
}
