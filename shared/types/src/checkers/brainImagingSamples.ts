import { createValidate } from 'typia'
import type { BrainImagingSamplesRequest, BrainImagingSamplesResponse } from '../routes/brainImagingSamples.ts'

export { brainImagingSamplesPayload } from '../routes/brainImagingSamples.ts'

export const validBrainImagingSamplesRequest = createValidate<BrainImagingSamplesRequest>()
export const validBrainImagingSamplesResponse = createValidate<BrainImagingSamplesResponse>()
