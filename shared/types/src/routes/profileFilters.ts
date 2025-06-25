import type { RoutePayload } from './routeApi.js'

export type ProfileFiltersRequest = {
	terms: any[]
	filters: { [termid: string]: any[] }
}

export type ProfileFiltersResponse = {
	[termId: string]: {
		label: string
		value: string
		disabled?: boolean
	}[]
}

export const ProfileFiltersPayload: RoutePayload = {
	request: {
		typeId: 'ProfileFiltersRequest'
	},
	response: {
		typeId: 'ProfileFiltersResponse'
	}
}
