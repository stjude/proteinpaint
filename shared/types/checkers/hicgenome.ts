import { createValidate } from 'typia'
import type { HicGenomeRequest, HicGenomeResponse } from '../src/routes/hicgenome.ts'

export { hicGenomePayload } from '../src/routes/hicgenome.ts'

export const validHicGenomeRequest = createValidate<HicGenomeRequest>()
export const validHicGenomeResponse = createValidate<HicGenomeResponse>()
