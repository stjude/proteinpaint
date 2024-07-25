import { getpercentileRequest, getpercentileResponse } from '#shared/types/routes/termdb.getpercentile.ts'
import * as termdbsql from '../src/termdb.sql.js'
import computePercentile from '../shared/compute.percentile.js'
import { Filter } from '#shared/types/filter.ts'

export const api: any = {
	endpoint: 'termdb/getpercentile',
	methods: {
		get: {
			init,
			request: {
				typeId: 'getpercentileRequest'
			},
			response: {
				typeId: 'getpercentileResponse'
			},
			examples: [
				{
					request: {
						body: {
							genome: 'hg38-test',
							dslabel: 'TermdbTest',
							embedder: 'localhost',
							getpercentile: [50],
							tid: 'agedx',
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
		const q = req.query as getpercentileRequest
		try {
			const g = genomes[req.query.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets[req.query.dslabel]
			if (!ds) throw 'invalid dataset name'
			await trigger_getpercentile(q, res, ds) // as getpercentileResponse
		} catch (e) {
			res.send({ error: e instanceof Error ? e.message : e })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}

async function trigger_getpercentile(
	q: { tid: string; getpercentile: number[]; filter: Filter },
	res: { send: (arg0: { values: number[] }) => void },
	ds: { cohort: { termdb: { q: { termjsonByOneid: (arg0: any) => any } } } }
) {
	const term = ds.cohort.termdb.q.termjsonByOneid(q.tid)
	if (!term) throw 'invalid termid'
	if (term.type != 'float' && term.type != 'integer') throw 'not numerical term'
	const percentile_lst = q.getpercentile
	const perc_values = [] as number[]
	const values = [] as number[]
	const rows = await termdbsql.get_rows_by_one_key({
		ds,
		key: q.tid,
		filter: q.filter ? (typeof q.filter == 'string' ? JSON.parse(q.filter) : q.filter) : null
	})
	for (const { value } of rows) {
		if (term.values && term.values[value] && term.values[value].uncomputable) {
			// skip uncomputable values
			continue
		}

		if (term.skip0forPercentile && value == 0) {
			// quick fix: when the flag is true, will exclude 0 values from percentile computing
			// to address an issue with computing knots
			continue
		}

		values.push(Number(value))
	}

	// compute percentiles
	for (const percentile of percentile_lst) {
		const perc_value = computePercentile(values, percentile)
		perc_values.push(perc_value)
	}
	res.send({ values: perc_values } as getpercentileResponse)
}
