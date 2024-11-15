import { createValidate } from 'typia'
import type { TermdbTopTermsByTypeRequest, TermdbTopTermsByTypeResponse } from '../routes/termdb.topTermsByType.ts'

export { termdbTopTermsByTypePayload } from '../routes/termdb.topTermsByType.ts'

export const validTermdbTopTermsByTypeRequest = createValidate<TermdbTopTermsByTypeRequest>()
export const validTermdbTopTermsByTypeResponse = createValidate<TermdbTopTermsByTypeResponse>()
