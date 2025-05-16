// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { BrainImagingSamplesRequest, BrainImagingSamplesResponse } from '../src/routes/brainImagingSamples.ts'

export { brainImagingSamplesPayload } from '../src/routes/brainImagingSamples.ts'

export const validBrainImagingSamplesRequest = createValidate<BrainImagingSamplesRequest>()
export const validBrainImagingSamplesResponse = createValidate<BrainImagingSamplesResponse>()
