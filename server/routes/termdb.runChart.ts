import type { RouteApi, RunChartRequest, RunChartResponse } from '#types'
import { runChartPayload } from '#types/checkers'
import { getData } from '../src/termdb.matrix.js'

export const api: RouteApi = {
	endpoint: 'termdb/runChart',
	methods: {
		get: {
			...runChartPayload,
			init
		},
		post: {
			...runChartPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const q: RunChartRequest = req.query
			const genome = genomes[q.genome]
			if (!genome) throw new Error('invalid genome name')
			const ds = genome.datasets?.[q.dslabel]
			if (!ds) throw new Error('invalid ds')

			if (!q.term || !q.term2) throw 'q.term or q.term2 missing'

			const tws = [
				{ term: q.term, q: { mode: 'continuous' } },
				{ term: q.term2, q: { mode: 'continuous' } }
			]
			const data = await getData(
				{
					filter: q.filter,
					terms: tws,
					__protected__: q.__protected__
				},
				ds
			)
			for (const k in data.samples) console.log(data.samples[k])

			const result: RunChartResponse = {
				status: 'ok',
				series: []
			}

			res.send(result)
		} catch (e: any) {
			console.log(e.stack)
			res.send({ error: e.message || e })
		}
	}
}
