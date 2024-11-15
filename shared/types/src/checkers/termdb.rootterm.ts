import { createValidate } from 'typia'
import type { RootTermRequest, RootTermResponse } from '../routes/termdb.rootterm.ts'

export { rootTermPayload } from '../routes/termdb.rootterm.ts'

export const validRootTermRequest = createValidate<RootTermRequest>()
export const validRootTermResponse = createValidate<RootTermResponse>()
