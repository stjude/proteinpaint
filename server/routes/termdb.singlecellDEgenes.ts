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
			if (!g) throw 'invalid genome name'
			const ds = g.datasets[q.dslabel]
			if (!ds) throw 'invalid dataset name'
			if (!ds.queries?.singleCell?.DEgenes) throw 'not supported on this dataset'
			result = await ds.queries.singleCell.DEgenes.get(q)
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
	} else {
		throw 'unknown singleCell.DEgenes.src'
	}
	// DEgenes.get() added
}
