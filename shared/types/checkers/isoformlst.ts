// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { IsoformLstRequest, IsoformLstResponse } from '../src/routes/isoformlst.ts'

export { isoformlstPayload } from '../src/routes/isoformlst.ts'

export const validIsoformLstRequest = createValidate<IsoformLstRequest>()
export const validIsoformLstResponse = createValidate<IsoformLstResponse>()
