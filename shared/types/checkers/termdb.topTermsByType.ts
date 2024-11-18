import { createValidate } from 'typia'
import type { TermdbTopTermsByTypeRequest, TermdbTopTermsByTypeResponse } from '../src/routes/termdb.topTermsByType.ts'

export { termdbTopTermsByTypePayload } from '../src/routes/termdb.topTermsByType.ts'

export const validTermdbTopTermsByTypeRequest = createValidate<TermdbTopTermsByTypeRequest>()
export const validTermdbTopTermsByTypeResponse = createValidate<TermdbTopTermsByTypeResponse>()
