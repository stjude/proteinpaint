import type { RouteApi, RoutePayload, TermdbSampleScatterRequest, Filter } from '#types'
import { validGenomeDs, validString, validBoolean } from './common.ts'
import { init } from '../../routes/termdb.sampleScatter.ts'

const payload: RoutePayload = {
	init,
	request: {
		typeId: 'TermdbSampleScatterRequest',
		checker: validTermdbSampleScatterRequest,
	},
	response: {
		typeId: 'TermdbSampleScatterResponse'
	}
}

export const api: RouteApi = {
	endpoint: 'termdb/sampleScatter',
	methods: {
		// This endpoint does not support write operation, the same readonly request/response 
		// payload init/typeId/checker is expected for both GET and POST methods, where POST
		// is used when the request payload is to large to be encoded as URL parameters.
		// may switch to using HTTP QUERY method once that is stable and widely supported
		get: payload,
		post: payload
	}
}

export function validTermdbSampleScatterRequest(input): TermdbSampleScatterRequest {
	return {
		...validGenomeDs(input),
		colorTW: input.colorTW as any, //TermWrapper, TODO: use a validator function or, even better, a class instance
		shapeTW: input.shapeTW as any, //TermWrapper Discrete
		divideByTW: input.divideByTW as any, //TermWrapper
		scaleDotTW: input.scaleDotTW as any, //TermWrapper
		coordTWs: input.coordTWs as any[], //TermWrapper[]
		plotName: !input.plotName ? undefined : validString(input.plotName, 'invalid plotName'),
		filter: input.filter as Filter, // TODO: use a filter validator
		filter0: input.filter0 as any,
		chartType: !input.chartType ? undefined : validString(input.chartType, 'invalid chartType'),
		singleCellPlot: input.singleCellPlot as any,
		colorColumn: input.colorColumn as any,
		excludeOutliers: validBoolean(input.excludeOutliers)
	}
}
