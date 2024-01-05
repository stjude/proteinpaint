import { getdescrstatsRequest, getdescrstatsResponse } from '#shared/types/routes/termdb.getdescrstats.ts'
import * as termdbsql from '../src/termdb.sql.js'
import Summarystats from '../shared/descriptive.stats.js'
import summaryStats from '../shared/descriptive.stats.js'

export const api: any = {
	endpoint: 'termdb/descrstats',
	methods: {
		get: {
			init,
			request: {
				typeId: 'getdescrstatsRequest'
			},
			response: {
				typeId: 'getdescrstatsResponse'
			},
			examples: [
				{
					request: {
						body: {
							genome: 'hg38-test',
							dslabel: 'TermdbTest',
							embedder: 'localhost',
							getdescrstats: 1,
							tid: 'hrtavg',
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
		const q = req.query as getdescrstatsRequest
		try {
			const g = genomes[req.query.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets[req.query.dslabel]
			if (!ds) throw 'invalid dataset name'
			const tdb = ds.cohort.termdb
			if (!tdb) throw 'invalid termdb object'

			await trigger_getdescrstats(q, res, ds) // as getdescrstatsResponse
		} catch (e) {
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			res.send({ error: e?.message || e })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}

async function trigger_getdescrstats(q: any, res: any, ds: any) {
	const term = ds.cohort.termdb.q.termjsonByOneid(q.tid)
	if (!term) throw 'invalid termid'
	if (term.type != 'float' && term.type != 'integer') throw 'not numerical term'
	const rows = await termdbsql.get_rows_by_one_key({
		ds,
		key: q.tid,
		filter: q.filter ? (typeof q.filter == 'string' ? JSON.parse(q.filter) : q.filter) : null
	})
	const values: number[] = []
	for (const { value } of rows) {
		if (term.values && term.values[value] && term.values[value].uncomputable) {
			// skip uncomputable values
			continue
		}
		//skip computing for zeros if scale is log.
		if (q.settings?.violin?.unit === 'log') {
			if (value === 0) {
				continue
			}
		}
		values.push(value)
	}
	res.send(Summarystats(values) as getdescrstatsResponse)
}
