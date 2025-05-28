// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { SampleWSIAiApiRequest, SampleWSIAiApiResponse } from '../src/routes/sampleWsiAiApi.ts'

export { sampleWsiAiApiPayload } from '../src/routes/sampleWsiAiApi.ts'

export const validSampleWSIAiApiRequest = createValidate<SampleWSIAiApiRequest>()
export const validSampleWSIAiApiResponse = createValidate<SampleWSIAiApiResponse>()
