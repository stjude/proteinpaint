import {
	TermdbSinglecellDEgenesRequest,
	TermdbSinglecellDEgenesResponse
} from '#shared/types/routes/termdb.singlecellDEgenes.ts'
import { gdc_validate_query_singleCell_DEgenes } from '#src/mds3.gdc.js'

/* route returns
 */

export const api: any = {
	endpoint: 'termdb/singlecellDEgenes',
	methods: {
		all: {
			init,
			request: {
				typeId: 'TermdbSinglecellDEgenesRequest'
			},
			response: {
				typeId: 'TermdbSinglecellDEgenesResponse'
			}
		}
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		const q = req.query as TermdbSinglecellDEgenesRequest
		let result
		try {
			const g = genomes[q.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets[q.dslabel]
			if (!ds) throw 'invalid dataset name'
			if (!ds.queries?.singleCell?.DEgenes) throw 'not supported on this dataset'
			result = (await ds.queries.singleCell.DEgenes.get(q)) as TermdbSinglecellDEgenesResponse
		} catch (e: any) {
			if (e.stack) console.log(e.stack)
			result = {
				status: e.status || 400,
				error: e.message || e
			} as TermdbSinglecellDEgenesResponse
		}
		res.send(result)
	}
}

export async function validate_query_singleCell_DEgenes(ds: any, genome: any) {
	if (ds.queries.singleCell.DEgenes.src == 'gdcapi') {
		gdc_validate_query_singleCell_DEgenes(ds, genome)
	} else {
		throw 'unknown singleCell.DEgenes.src'
	}
	// DEgenes.get() added
}
