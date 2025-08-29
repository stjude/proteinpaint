// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { SaveWSIAnnotationRequest, SaveWSIAnnotationResponse } from '../src/routes/saveWSIAnnotation.ts'

export { saveWSIAnnotationPayload } from '../src/routes/saveWSIAnnotation.ts'

export const validSaveWSIAnnotationRequest = createValidate<SaveWSIAnnotationRequest>()
export const validSaveWSIAnnotationResponse = createValidate<SaveWSIAnnotationResponse>()
