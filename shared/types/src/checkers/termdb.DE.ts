import { createValidate } from 'typia'
import type { DERequest, DEResponse } from '../routes/termdb.DE.ts'

export { diffExpPayload } from '../routes/termdb.DE.ts'

export const validDERequest = createValidate<DERequest>()
export const validDEResponse = createValidate<DEResponse>()
