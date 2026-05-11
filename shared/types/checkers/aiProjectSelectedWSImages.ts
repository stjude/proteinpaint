// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type {
	AiProjectSelectedWSImagesRequest,
	AiProjectSelectedWSImagesResponse
} from '../src/routes/aiProjectSelectedWSImages.ts'

export { FeaturePrefixes } from '../src/routes/aiProjectSelectedWSImages.ts'
export { FlagStatus } from '../src/routes/aiProjectSelectedWSImages.ts'
export { FlagStatusMessages } from '../src/routes/aiProjectSelectedWSImages.ts'
export { SelectionPrefixes } from '../src/routes/aiProjectSelectedWSImages.ts'
export { aiProjectSelectedWSImagesResponsePayload } from '../src/routes/aiProjectSelectedWSImages.ts'
export { checkSelectionType } from '../src/routes/aiProjectSelectedWSImages.ts'
export { createFeatureID } from '../src/routes/aiProjectSelectedWSImages.ts'
export { createSelectionID } from '../src/routes/aiProjectSelectedWSImages.ts'

export const validAiProjectSelectedWSImagesRequest = createValidate<AiProjectSelectedWSImagesRequest>()
export const validAiProjectSelectedWSImagesResponse = createValidate<AiProjectSelectedWSImagesResponse>()
