import { getdescrstatsRequest, getdescrstatsResponse } from '#shared/types/routes/termdb.getdescrstats.ts'
import roundValue from '#shared/roundValue.js'
import computePercentile from '#shared/compute.percentile.js'
import * as termdbsql from '#src/termdb.sql.js'

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

	// compute statistics
	// total
	const total = values.length

	// mean
	const sum = values.reduce((a, b) => a + b, 0)
	const mean = sum / total

	// percentiles
	const p25 = computePercentile(values, 25)
	const median = computePercentile(values, 50)
	const p75 = computePercentile(values, 75)

	// standard deviation
	// get sum of squared differences from mean
	const sumSqDiff = values.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0)
	// get variance
	const variance = sumSqDiff / (values.length - 1)
	// get standard deviation
	const sd = Math.sqrt(variance)

	// min/max
	const min = Math.min(...values)
	const max = Math.max(...values)

	res.send({
		values: [
			{ id: 'total', label: 'n', value: total },
			{ id: 'min', label: 'Minimum', value: roundValue(min, 2) },
			{ id: 'p25', label: '1st quartile', value: roundValue(p25, 2) },
			{ id: 'median', label: 'Median', value: roundValue(median, 2) },
			{ id: 'mean', label: 'Mean', value: roundValue(mean, 2) },
			{ id: 'p75', label: '3rd quartile', value: roundValue(p75, 2) },
			{ id: 'max', label: 'Maximum', value: roundValue(max, 2) },
			{ id: 'sd', label: 'Standard deviation', value: roundValue(sd, 2) }
		]
	} as getdescrstatsResponse)
}
