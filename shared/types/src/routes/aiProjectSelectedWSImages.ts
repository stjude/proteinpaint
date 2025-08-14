import type { RoutePayload } from './routeApi.ts'
import type { WSImage } from './samplewsimages.ts'

export type AiProjectSelectedWSImagesRequest = {
	genome: string
	dslabel: string
	project_id: string
	wsimages: Array<string>
}

export type AiProjectSelectedWSImagesResponse = {
	// TODO create a type for WSImage with AI project specific fields
	wsimages: WSImage[]
}

export const aiProjectSelectedWSImagesResponsePayload: RoutePayload = {
	request: {
		typeId: 'AiProjectSelectedWSImagesRequest'
	},
	response: {
		typeId: 'AiProjectSelectedWSImagesResponse'
	}
	// examples: []
}
