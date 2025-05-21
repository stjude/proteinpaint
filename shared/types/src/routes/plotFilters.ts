import type { RoutePayload } from './routeApi.js'

export type PlotFiltersRequest = {
	file: string
}

export type PlotFiltersResponse = {
	src: string
	size: string
}

export const PlotFiltersPayload: RoutePayload = {
	request: {
		typeId: 'PlotFiltersRequest'
	},
	response: {
		typeId: 'PlotFiltersResponse'
	}
}
