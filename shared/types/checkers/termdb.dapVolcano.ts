// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { DapVolcanoRequest, DapVolcanoResponse } from '../src/routes/termdb.dapVolcano.ts'

export { dapVolcanoPayload } from '../src/routes/termdb.dapVolcano.ts'

export const validDapVolcanoRequest = createValidate<DapVolcanoRequest>()
export const validDapVolcanoResponse = createValidate<DapVolcanoResponse>()
