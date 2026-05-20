import type { RoutePayload, TermdbSampleScatterRequest, Filter } from '#types'
import { validGenomeDs, validString, validBoolean } from './common.ts'

export const termdbSampleScatterPayload: RoutePayload = {
	request: {
		typeId: 'TermdbSampleScatterRequest',
		checker: validTermdbSampleScatterRequest
	},
	response: {
		typeId: 'TermdbSampleScatterResponse'
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
