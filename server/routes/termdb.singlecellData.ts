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
			if (!g) throw new Error('invalid genome name')
			const ds = g.datasets[q.dslabel]
			if (!ds) throw new Error('invalid dataset name')
			if (!ds.queries?.singleCell) throw new Error('no single cell data on this dataset')
			if (!ds.queries.singleCell.data?.get) throw new Error('dataset has no single cell data get() function')
			/** If .get() not defined in ds file, defined in
			 * server/src/mds3.gdc.js (gdc only for now). */
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
