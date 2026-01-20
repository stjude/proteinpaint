import type { RouteApi, RunChartRequest, RunChartResponse } from '#types'
import { runChartPayload } from '#types/checkers'
import { getData } from '../src/termdb.matrix.js'
import { buildRunChartFromData } from './runChart.helper.ts'

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

export async function getRunChart(q: RunChartRequest, ds: any): Promise<RunChartResponse> {
	// Collect terms from term and term2
	const terms: any = []
	let xTermId: string | undefined
	let yTermId: string | undefined

	if (q.term && q.term2) {
		const tws = [
			{ term: q.term, q: { mode: 'continuous' }, $id: q.term.id },
			{ term: q.term2, q: { mode: 'continuous' }, $id: q.term2.id }
		]
		terms.push(...tws)
		xTermId = q.term.id
		yTermId = q.term2.id
	} else {
		throw new Error('term and term2 must be provided')
	}

	if (!xTermId || !yTermId) {
		throw new Error('Unable to determine term IDs for x and y axes')
	}

	const data = await getData(
		{
			filter: q.filter,
			terms,
			__protected__: q.__protected__
		},
		ds,
		true
	)

	if (data.error) throw new Error(data.error)

	const chartType = (q as any).chartType || 'mean' // 'mean' | 'proportion' | 'count'
	return buildRunChartFromData(chartType, xTermId, yTermId, data)
}

// buildRunChartFromData lives in runChart.helper.ts for easier unit testing

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const q: RunChartRequest = req.query
			const genome = genomes[q.genome]
			if (!genome) throw new Error('invalid genome name')
			const ds = genome.datasets?.[q.dslabel]
			if (!ds) throw new Error('invalid ds')

			const result = await getRunChart(q, ds)
			res.send(result)
		} catch (e: any) {
			console.log(e.stack)
			res.send({ error: e.message || e })
		}
	}
}
