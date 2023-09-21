import { createValidate } from 'typia'
import { AbcRequest, AbcResponse } from '../types/abc.ts'

export const validAbcRequest = createValidate<AbcRequest>()
export const validAbcResponse = createValidate<AbcResponse>()
