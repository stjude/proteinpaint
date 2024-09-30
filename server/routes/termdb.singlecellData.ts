import type { TermdbSinglecellDataRequest, TermdbSinglecellDataResponse } from '#routeTypes/termdb.singlecellData.ts'

/*
given a sample, return it's singlecell data from dataset
*/

export const api: any = {
	endpoint: 'termdb/singlecellData',
	methods: {
		get: {
			init,
			request: {
				typeId: 'TermdbSinglecellDataRequest'
			},
			response: {
				typeId: 'TermdbSinglecellDataResponse'
			}
		},
		post: {
			alternativeFor: 'get',
			init
		}
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		const q = req.query as TermdbSinglecellDataRequest
		let result
		try {
			const g = genomes[q.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets[q.dslabel]
			if (!ds) throw 'invalid dataset name'
			if (!ds.queries?.singleCell) throw 'no singlecell data on this dataset'
			result = (await ds.queries.singleCell.data.get(q)) as TermdbSinglecellDataResponse
		} catch (e: any) {
			if (e.stack) console.log(e)
			result = {
				status: e.status || 400,
				error: e.message || e
			} as TermdbSinglecellDataResponse
		}
		res.send(result)
	}
}
