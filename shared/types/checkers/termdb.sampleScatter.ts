// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { TermdbSampleScatterRequest, TermdbSampleScatterResponse } from '../src/routes/termdb.sampleScatter.ts'

export { termdbSampleScatterPayload } from '../src/routes/termdb.sampleScatter.ts'

export const validTermdbSampleScatterRequest = createValidate<TermdbSampleScatterRequest>()
export const validTermdbSampleScatterResponse = createValidate<TermdbSampleScatterResponse>()
