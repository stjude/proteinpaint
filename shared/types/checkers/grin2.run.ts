// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { GRIN2Request, GRIN2Response } from '../src/routes/grin2.run.ts'

export { GRIN2Payload } from '../src/routes/grin2.run.ts'

export const validGRIN2Request = createValidate<GRIN2Request>()
export const validGRIN2Response = createValidate<GRIN2Response>()
