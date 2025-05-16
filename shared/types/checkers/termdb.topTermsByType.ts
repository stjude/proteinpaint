// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { TermdbTopTermsByTypeRequest, TermdbTopTermsByTypeResponse } from '../src/routes/termdb.topTermsByType.ts'

export { termdbTopTermsByTypePayload } from '../src/routes/termdb.topTermsByType.ts'

export const validTermdbTopTermsByTypeRequest = createValidate<TermdbTopTermsByTypeRequest>()
export const validTermdbTopTermsByTypeResponse = createValidate<TermdbTopTermsByTypeResponse>()
