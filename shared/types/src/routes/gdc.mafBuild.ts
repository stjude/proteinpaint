import type { RoutePayload } from './routeApi.ts'

export type GdcMafBuildRequest = {
	/** List of input file uuids in gdc */
	fileIdLst: string[]
	/** List of columns in output MAF file */
	columns: string[]
}

export type GdcMafBuildResponse = any

export const GdcMafPayload: RoutePayload = {
	request: {
		typeId: 'GdcMafRequest'
	},
	response: {
		typeId: 'GdcMafResponse'
	}
	//examples: []
}
