import type { RoutePayload, TermdbSampleScatterRequest, Filter } from '#types'
import { validGenomeDs, validString } from './common.ts'

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
		...validGenomeDs(input.genome),
		colorTW: input.colorTW as any, //TermWrapper
		shapeTW: input.shapeTW as any, //TermWrapper
		divideByTW: input.shapeTW as any, //TermWrapper
		scaleDotTW: input.scaleDotTW as any, //TermWrapper
		coordTWs: input.coordTWs as any[], //TermWrapper[]
		plotName: validString(input.plotName, 'invalid plotName'),
		filter: input.filter as Filter, // TODO: use a filter validator
		filter0: input.filter0 as any,
		chartType: validString(input.chartType, 'invalid chartType'),
		singleCellPlot: input.singleCellPlot as any,
		colorColumn: input.colorColumn as any,
		excludeOutliers: input.excludeOutliers
	}
}
