import { createValidate } from 'typia'
import type { IsoformLstRequest, IsoformLstResponse } from '../src/routes/isoformlst.ts'

export { isoformlstPayload } from '../src/routes/isoformlst.ts'

export const validIsoformLstRequest = createValidate<IsoformLstRequest>()
export const validIsoformLstResponse = createValidate<IsoformLstResponse>()
