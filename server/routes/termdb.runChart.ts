import type { RouteApi, RunChartRequest, RunChartResponse } from '#types'
import { runChartPayload } from '#types/checkers'

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
		const q: RunChartRequest = req.query
		const genome = genomes[q.genome]
		if (!genome) throw new Error('invalid genome name')
		const ds = genome.datasets?.[q.dslabel]
		if (!ds) throw new Error('invalid ds')

		const result: RunChartResponse = {
			status: 'ok',
			series: []
		}

		res.send(result)
	}
}
