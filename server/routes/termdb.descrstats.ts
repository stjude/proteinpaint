import type { DescrStatsRequest, DescrStatsResponse, RouteApi } from '#types'
import { descrStatsPayload } from '#types/checkers'
import { summaryStats } from '#shared/descriptive.stats.js'
import { getData } from '#src/termdb.matrix.js'

export const api: RouteApi = {
	endpoint: 'termdb/descrstats',
	methods: {
		get: {
			...descrStatsPayload,
			init
		},
		post: {
			...descrStatsPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		const q: DescrStatsRequest = req.query
		let result
		try {
			const genome = genomes[req.query.genome]
			if (!genome) throw 'invalid genome name'
			const ds = genome.datasets[req.query.dslabel]
			if (!ds) throw 'invalid dataset name'
			const tdb = ds.cohort.termdb
			if (!tdb) throw 'invalid termdb object'

			if (!q.tw.$id) q.tw.$id = '_' // current typing thinks tw$id is undefined. add this to avoid tsc err. delete this line when typing is fixed
			const data = await getData(
				{ filter: q.filter, filter0: q.filter0, terms: [q.tw], __protected__: q.__protected__ },
				ds
			)
			if (data.error) throw data.error

			const values: number[] = []
			for (const key in data.samples) {
				const sample = data.samples[key]
				const v = sample[q.tw.$id]
				if (!v && v !== 0) {
					// skip undefined values
					continue
				}
				const value = v.value
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
				result = summaryStats(values)
			} else {
				// no computable values. do not get stats as it breaks code. set result to blank obj to avoid "missing response.header['content-type']" err on client
				result = {}
			}
		} catch (e: any) {
			if (e instanceof Error && e.stack) console.log(e)
			result = { error: e?.message || e }
		}
		res.send(result satisfies DescrStatsResponse)
	}
}
