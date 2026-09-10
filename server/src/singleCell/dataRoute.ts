import { validGenomeDs, validBoolean, validString } from '#routes/common.ts'
import type { RoutePayload, TermdbSingleCellDataRequest, TermdbSingleCellDataResponse, RouteApi } from '#types'

export const payload: RoutePayload = {
	init,
	request: {
		typeId: 'TermdbSingleCellDataRequest',
		checker: validTermdbSingleCellDataRequest
	},
	response: { typeId: 'TermdbSingleCellDataResponse' }
}

/* given a sample, return it's singlecell data from dataset */

export const api: RouteApi = {
	endpoint: 'termdb/singlecellData',
	methods: {
		get: payload,
		post: payload
	}
}

function validTermdbSingleCellDataRequest(input): TermdbSingleCellDataRequest {
	return {
		...validGenomeDs(input),
		sample: {
			sID: validString(input.sample?.sID),
			eID: input.sample?.eID ? validString(input.sample.eID) : undefined
		},
		plots: Array.isArray(input.plots) ? input.plots.map(validString) : [],
		checkPlotAvailability: input.checkPlotAvailability ? validBoolean(input.checkPlotAvailability) : undefined,
		gene: input.gene ? validString(input.gene) : undefined,
		listGenes: input.listGenes ? validBoolean(input.listGenes) : false, // required: absent = plot data as usual
		colorBy: input.colorBy ? validString(input.colorBy) : undefined,
		colorMap: typeof input.colorMap === 'object' && input.colorMap !== null ? input.colorMap : undefined,
		singleCellPlot: input.singleCellPlot
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
			if (q.listGenes) {
				// list the genes of this sample's expression store, not plot data
				const G = ds.queries.singleCell.geneExpression
				if (!G) throw new Error('no single cell gene expression on this dataset')
				if (typeof G.listGenes != 'function')
					// ds supplies its own getters (e.g. gdc) without a listGenes
					throw new Error('gene listing not supported by this dataset')
				result = await G.listGenes(q.sample) // {assay, genes?}; validSampleId picks the file name
			} else {
				if (!ds.queries.singleCell.data?.get) throw new Error('dataset has no single cell data get() function')
				/** data.get() not defined in ds file, defined in
				 * ppgdc gdc/queries.js for gdc. For native ds,
				 * validateDataNative() in samplesRoute.ts */
				result = await ds.queries.singleCell.data.get(q)
			}
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
