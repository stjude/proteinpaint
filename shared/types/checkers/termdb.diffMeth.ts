// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { DiffMethRequest, DiffMethResponse } from '../src/routes/termdb.diffMeth.ts'

export { diffMethPayload } from '../src/routes/termdb.diffMeth.ts'

export const validDiffMethRequest = createValidate<DiffMethRequest>()
export const validDiffMethResponse = createValidate<DiffMethResponse>()
