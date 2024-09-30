import type { getdescrstatsRequest, getdescrstatsResponse } from '#types'
import Summarystats from '#shared/descriptive.stats.js'
import { getData } from '#src/termdb.matrix.js'

export const api: any = {
	endpoint: 'termdb/descrstats',
	methods: {
		all: {
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
							tw: { term: { id: 'hrtavg' }, q: { mode: 'continuous' } },
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
		}
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		const q = req.query as getdescrstatsRequest
		let result
		try {
			const genome = genomes[req.query.genome]
			if (!genome) throw 'invalid genome name'
			const ds = genome.datasets[req.query.dslabel]
			if (!ds) throw 'invalid dataset name'
			const tdb = ds.cohort.termdb
			if (!tdb) throw 'invalid termdb object'

			if (!q.tw.$id) q.tw.$id = '_' // current typing thinks tw$id is undefined. add this to avoid tsc err. delete this line when typing is fixed
			const data = await getData({ filter: q.filter, filter0: q.filter0, terms: [q.tw] }, ds, genome)
			if (data.error) throw data.error

			const values: number[] = []
			for (const key in data.samples) {
				const sample = data.samples[key]
				const value = sample[q.tw.$id].value
				if (q.tw.q.hiddenValues?.[value]) {
					// skip uncomputable values
					continue
				}
				//skip computing for zeros if scale is log.
				if (q.logScale) {
					if (value === 0) {
						continue
					}
				}
				values.push(Number(value))
			}

			if (values.length) {
				result = Summarystats(values) as getdescrstatsResponse
			} else {
				// no computable values. do not get stats as it breaks code. set result to blank obj to avoid "missing response.header['content-type']" err on client
				result = {}
			}
		} catch (e: any) {
			if (e instanceof Error && e.stack) console.log(e)
			result = { error: e?.message || e } as getdescrstatsResponse
		}
		res.send(result)
	}
}
