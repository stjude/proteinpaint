import type { TermdbSingleCellDEgenesRequest, TermdbSingleCellDEgenesResponse, RouteApi } from '#types'
import { termdbSingleCellDEgenesPayload } from '#types/checkers'
import { gdc_validate_query_singleCell_DEgenes } from '#src/mds3.gdc.js'

/* 
for a singlecell experiment, user selects a cell cluster, and the route returns DE genes of the cluster against rest of the cells
 */

export const api: RouteApi = {
	endpoint: 'termdb/singlecellDEgenes',
	methods: {
		get: {
			...termdbSingleCellDEgenesPayload,
			init
		},
		post: {
			...termdbSingleCellDEgenesPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		const q: TermdbSingleCellDEgenesRequest = req.query
		let result
		try {
			const g = genomes[q.genome]
			if (!g) throw new Error('invalid genome name')
			const ds = g.datasets[q.dslabel]
			if (!ds) throw new Error('invalid dataset name')
			if (!ds.queries?.singleCell?.DEgenes || !ds.queries.singleCell.DEgenes.get)
				throw new Error('DE genes not supported on this dataset.')
			result = await ds.queries.singleCell.DEgenes.get(q)
			if (!result || !result.data || !result?.data?.length) {
				result = {
					status: 404,
					error: !result ? 'No data found.' : 'No differentially expressed genes found.'
				}
			}
		} catch (e: any) {
			if (e.stack) console.log(e.stack)
			result = {
				status: e.status || 400,
				error: e.message || e
			}
		}
		res.send(result satisfies TermdbSingleCellDEgenesResponse)
	}
}

export async function validate_query_singleCell_DEgenes(ds: any) {
	if (ds.queries.singleCell.DEgenes.src == 'gdcapi') {
		gdc_validate_query_singleCell_DEgenes(ds)
	}
	//TODO: Implement query valiation for non gdc ds
	else {
		throw new Error('unknown singleCell.DEgenes.src')
	}
	// DEgenes.get() added
}
