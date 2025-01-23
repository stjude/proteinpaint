import type { RoutePayload } from './routeApi.js'

export type imgRequest = {
	file: string
}

export type SrcImage = {
	src: any
}

export type imgResponse = {
	src: string
	size: string
}

export const imgPayload: RoutePayload = {
	request: {
		typeId: 'imgRequest'
	},
	response: {
		typeId: 'imgResponse'
	}
}
