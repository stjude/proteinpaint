import type { TermdbSingleCellDataRequest, TermdbSingleCellDataResponse, RouteApi } from '#types'
import { termdbSingleCellDataPayload } from '#types/checkers'

/*
given a sample, return it's singlecell data from dataset
*/

export const api: RouteApi = {
	endpoint: 'termdb/singlecellData',
	methods: {
		get: {
			...termdbSingleCellDataPayload,
			init
		},
		post: {
			...termdbSingleCellDataPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		const q: TermdbSingleCellDataRequest = req.query
		let result
		try {
			const g = genomes[q.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets[q.dslabel]
			if (!ds) throw 'invalid dataset name'
			if (!ds.queries?.singleCell) throw 'no singlecell data on this dataset'
			result = await ds.queries.singleCell.data.get(q)
		} catch (e: any) {
			if (e.stack) console.log(e)
			result = {
				status: e.status || 400,
				error: e.message || e
			}
		}
		res.send(result satisfies TermdbSingleCellDataResponse)
	}
}
