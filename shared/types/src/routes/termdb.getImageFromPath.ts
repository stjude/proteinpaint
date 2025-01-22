import type { RoutePayload } from './routeApi.js'

export type TermdbGetImageFromPathRequest = {
	genome: string
	/** Ds label */
	dslabel: string
	filePath: string
}

export type SrcImage = {
	src: any
}

export type TermdbGetImageFromPathResponse = {
	image: SrcImage
}

export const termdbGetImageFromPathPayload: RoutePayload = {
	request: {
		typeId: 'TermdbGetImageFromPathRequest'
	},
	response: {
		typeId: 'TermdbGetImageFromPathResponse'
	}
}
