import { RoutePayload } from './routeApi.js'

export type IsoformLstRequest = any
export type IsoformLstResponse = any

export const isoformlstPayload: RoutePayload = {
	request: {
		typeId: 'IsoformLstRequest'
	},
	response: {
		typeId: 'IsoformLstResponse'
	}
	//examples: []
}
