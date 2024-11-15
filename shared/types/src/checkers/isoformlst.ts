import { createValidate } from 'typia'
import type { IsoformLstRequest, IsoformLstResponse } from '../routes/isoformlst.ts'

export { isoformlstPayload } from '../routes/isoformlst.ts'

export const validIsoformLstRequest = createValidate<IsoformLstRequest>()
export const validIsoformLstResponse = createValidate<IsoformLstResponse>()
