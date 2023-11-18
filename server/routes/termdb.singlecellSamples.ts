import {
	TermdbSinglecellsamplesRequest,
	TermdbSinglecellsamplesResponse
} from '#shared/types/routes/termdb.singlecellSamples.ts'

/* route returns list of samples with sc data
this is due to the fact that sometimes not all samples in a dataset has sc data
*/

export const api: any = {
	endpoint: 'termdb/singlecellSamples',
	methods: {
		get: {
			init,
			request: {
				typeId: 'TermdbSinglecellsamplesRequest'
			},
			response: {
				typeId: 'TermdbSinglecellsamplesResponse'
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
		const q = req.query as TermdbSinglecellsamplesRequest
		try {
			const g = genomes[q.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets[q.dslabel]
			if (!ds) throw 'invalid dataset name'
			if (!ds.queries?.singleCell) throw 'no singlecell data on this dataset'
			const samples = (await ds.queries.singleCell.samples.get(q)) as TermdbSinglecellsamplesResponse
			res.send({ samples })
		} catch (e: any) {
			if (e instanceof Error && e.stack) console.log(e)
			res.send({ error: e.message || e })
		}
	}
}
