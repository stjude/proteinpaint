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
