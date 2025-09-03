// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { DeleteWSIAnnotationRequest, DeleteWSIAnnoationResponse } from '../src/routes/deleteWSIAnnotation.ts'

export { deleteWSIAnnotationPayload } from '../src/routes/deleteWSIAnnotation.ts'

export const validDeleteWSIAnnotationRequest = createValidate<DeleteWSIAnnotationRequest>()
export const validDeleteWSIAnnoationResponse = createValidate<DeleteWSIAnnoationResponse>()
