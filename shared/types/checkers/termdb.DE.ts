// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { DERequest, DEResponse } from '../src/routes/termdb.DE.ts'

export { diffExpPayload } from '../src/routes/termdb.DE.ts'

export const validDERequest = createValidate<DERequest>()
export const validDEResponse = createValidate<DEResponse>()
