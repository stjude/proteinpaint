import { getdescrstatsRequest, getdescrstatsResponse } from '#shared/types/routes/termdb.getdescrstats.ts'
import Summarystats from '../shared/descriptive.stats.js'
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

			await trigger_getdescrstats(q, res, ds, g) // as getdescrstatsResponse
		} catch (e) {
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			res.send({ error: e?.message || e })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}

async function trigger_getdescrstats(q: any, res: any, ds: any, genome: any) {
	const terms = [q.tw] //pass
	const data = await getData({ filter: q.filter, terms }, ds, genome)
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
		if (q.settings?.violin?.unit === 'log') {
			if (value === 0) {
				continue
			}
		}
		values.push(parseFloat(value))
	}

	res.send(Summarystats(values) as getdescrstatsResponse)
}
