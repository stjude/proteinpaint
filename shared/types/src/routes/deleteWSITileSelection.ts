import type { RoutePayload } from './routeApi.ts'
import type { TileSelection } from './aiProjectSelectedWSImages.ts'

export type DeleteWSITileSelectionRequest = {
	genome: string
	dslabel: string
	projectId: number
	tileSelection: TileSelection
	predictionClassId: string
	tileSelectionType: number
	wsimage: string
}

export type DeleteWSITileSelectionResponse = {
	status: string
	error?: string
}

export const deleteWSITileSelectionPayload: RoutePayload = {
	request: {
		typeId: 'DeleteWSITileSelectionRequest'
	},
	response: {
		typeId: 'DeleteWSITileSelectionResponse'
	}
}
