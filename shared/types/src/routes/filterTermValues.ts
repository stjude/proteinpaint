import type { RoutePayload } from './routeApi.ts'

export type FilterTermValuesRequest = {
	terms: any[]
	filters: { [termid: string]: any[] }
}

export type FilterTermValuesResponse = {
	[termId: string]: {
		label: string
		value: string
		disabled?: boolean
	}[]
}

export const FilterTermValuesPayload: RoutePayload = {
	request: {
		typeId: 'FilterTermValuesRequest'
	},
	response: {
		typeId: 'FilterTermValuesResponse'
	}
}
