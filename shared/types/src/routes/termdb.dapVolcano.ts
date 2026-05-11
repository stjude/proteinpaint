import type { RoutePayload } from './routeApi.js'
import type { ErrorResponse } from './errorResponse.ts'
import type { DataEntry, VolcanoData, VolcanoRenderRequest } from './termdb.DE.js'

export type DapVolcanoRequest = {
	genome: string
	dslabel: string
	organism: string
	assay: string
	cohort: string
	volcanoRender?: VolcanoRenderRequest
	countsOnly?: boolean
}

export type DapEntry = DataEntry & {
	gene_name: string
	gene: string
}

export type DapVolcanoResponse =
	| ErrorResponse
	| {
			data: VolcanoData<DapEntry>
	  }

export const dapVolcanoPayload: RoutePayload = {
	request: {
		typeId: 'DapVolcanoRequest'
	},
	response: {
		typeId: 'DapVolcanoResponse'
	}
}
