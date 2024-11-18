import { createValidate } from 'typia'
import type { RootTermRequest, RootTermResponse } from '../src/routes/termdb.rootterm.ts'

export { rootTermPayload } from '../src/routes/termdb.rootterm.ts'

export const validRootTermRequest = createValidate<RootTermRequest>()
export const validRootTermResponse = createValidate<RootTermResponse>()
