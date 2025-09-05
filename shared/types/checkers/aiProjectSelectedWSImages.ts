// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type {
	AiProjectSelectedWSImagesRequest,
	AiProjectSelectedWSImagesResponse
} from '../src/routes/aiProjectSelectedWSImages.ts'

export { aiProjectSelectedWSImagesResponsePayload } from '../src/routes/aiProjectSelectedWSImages.ts'

export const validAiProjectSelectedWSImagesRequest = createValidate<AiProjectSelectedWSImagesRequest>()
export const validAiProjectSelectedWSImagesResponse = createValidate<AiProjectSelectedWSImagesResponse>()
