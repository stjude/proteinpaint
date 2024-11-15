import { createValidate } from 'typia'
import type { BurdenRequest, BurdenResponse } from '../routes/burden.ts'

export { burdenPayload } from '../routes/burden.ts'

export const validBurdenRequest = createValidate<BurdenRequest>()
export const validBurdenResponse = createValidate<BurdenResponse>()
