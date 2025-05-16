// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { RootTermRequest, RootTermResponse } from '../src/routes/termdb.rootterm.ts'

export { rootTermPayload } from '../src/routes/termdb.rootterm.ts'

export const validRootTermRequest = createValidate<RootTermRequest>()
export const validRootTermResponse = createValidate<RootTermResponse>()
