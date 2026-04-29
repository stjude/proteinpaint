import type { TileSelection } from 'src/index.ts'
import type { RoutePayload } from './routeApi.ts'

export type SaveWSIAnnotationRequest = {
	genome: string
	dslabel: string
	tileSelection: TileSelection
	classId: number
	projectId: number
	wsimage: string
}

export type SaveWSIAnnotationResponse = {
	status: 'ok' | 'error'
	error?: string
}

export const saveWSIAnnotationPayload: RoutePayload = {
	request: {
		typeId: 'SaveWSIAnnotationRequest'
	},
	response: {
		typeId: 'SaveWSIAnnotationResponse'
	}
}
