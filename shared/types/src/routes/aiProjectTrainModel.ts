import type { RoutePayload } from './routeApi.ts'

export type AIProjectTrainModelRequest = {
	genome: any
	dslabel: any
}

export type AIProjectTrainModelResponse = {
	status: 'ok' | 'error'
}

export const aiProjectTrainModelPayload: RoutePayload = {
	request: {
		typeId: 'AIProjectTrainModelRequest'
	},
	response: {
		typeId: 'AIProjectTrainModelResponse'
	}
}
