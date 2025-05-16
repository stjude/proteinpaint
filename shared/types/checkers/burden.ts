// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { BurdenRequest, BurdenResponse } from '../src/routes/burden.ts'

export { burdenPayload } from '../src/routes/burden.ts'

export const validBurdenRequest = createValidate<BurdenRequest>()
export const validBurdenResponse = createValidate<BurdenResponse>()
