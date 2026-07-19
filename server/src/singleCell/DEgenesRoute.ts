import type { RoutePayload, TermdbSingleCellDEgenesRequest, TermdbSingleCellDEgenesResponse, RouteApi } from '#types'
import { gdc_validate_query_singleCell_DEgenes } from '#src/mds3.gdc.js'
import { validGenomeDs, validString } from '#routes/common.ts'

export const payload: RoutePayload = {
	init,
	request: {
		typeId: 'TermdbSingleCellDEgenesRequest',
		checker: validTermdbSingleCellDEgenesRequest
	},
	response: { typeId: 'TermdbSingleCellDEgenesResponse' }
}

/* for a singlecell experiment, user selects a cell cluster, and the 
route returns DE genes of the cluster against rest of the cells */

export const api: RouteApi = {
	endpoint: 'termdb/singlecellDEgenes',
	methods: {
		get: payload,
		post: payload
	}
}

function validTermdbSingleCellDEgenesRequest(input): TermdbSingleCellDEgenesRequest {
	const validateSample = () => {
		/** This is legacy support for the old singleCellPlot that passes the sample
		 * as a single string. */
		if (typeof input.sample === 'string') validString(input.sample)
		else {
			if (typeof input.sample != 'object' || !input.sample.sID)
				throw 'sample should be a string or an object with a non-empty sID string property'
			validString(input.sample.sID)
			if (input.sample.eID) validString(input.sample.eID)
		}
		return input.sample
	}

	return {
		...validGenomeDs(input),
		sample: validateSample(),
		termId: input.termId ? validString(input.termId) : undefined,
		categoryName: validString(input.categoryName),
		volcanoRender: input.volcanoRender
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
				throw new Error('Single cell DE genes not supported on this dataset.')
			result = await ds.queries.singleCell.DEgenes.get(q)
			// data can be either a plain gene array (non-volcano callers) or a
			// VolcanoData object (volcano callers). Both count as empty only if
			// there are truly no rows — for the array shape that's length===0,
			// for the volcano shape that's totalRows===0.
			const isEmpty =
				!result || !result.data || (Array.isArray(result.data) ? result.data.length === 0 : !result.data.totalRows)
			if (isEmpty) {
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
	if (typeof ds.queries.singleCell.DEgenes.get == 'function') return // ds supplied getter
	if (ds.queries.singleCell.DEgenes.src == 'gdcapi') {
		gdc_validate_query_singleCell_DEgenes(ds)
	}
	//TODO: Implement query valiation for non gdc ds
	else {
		throw new Error('unknown singleCell.DEgenes.src')
	}
	// DEgenes.get() added
}
