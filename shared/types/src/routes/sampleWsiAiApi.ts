import type { RoutePayload } from './routeApi.ts'

export type SampleWSIAiApiRequest = {
	index: number
	confirmed: boolean
	class: number | null
}

export type SampleWSIAiApiResponse = {
	status: 'ok' | 'error'
	error?: string
}

export const sampleWsiAiApiPayload: RoutePayload = {
	request: {
		typeId: 'SampleWSIAiApiRequest'
	},
	response: {
		typeId: 'SampleWSIAiApiResponse'
	}
}
