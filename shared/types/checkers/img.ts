import { createValidate } from 'typia'
import type { imgRequest, imgResponse } from '../src/routes/img.ts'

export { imgPayload } from '../src/routes/img.ts'

export const validimgRequest = createValidate<imgRequest>()
export const validimgResponse = createValidate<imgResponse>()
