// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { alphaGenomeRequest, alphaGenomeResponse } from '../src/routes/alphaGenome.ts'

export { alphaGenomePayload } from '../src/routes/alphaGenome.ts'

export const validalphaGenomeRequest = createValidate<alphaGenomeRequest>()
export const validalphaGenomeResponse = createValidate<alphaGenomeResponse>()
