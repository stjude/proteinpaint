// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { TermdbProteomeRequest, TermdbProteomeResponse } from '../src/routes/termdb.proteome.ts'

export { termdbProteomePayload } from '../src/routes/termdb.proteome.ts'

export const validTermdbProteomeRequest = createValidate<TermdbProteomeRequest>()
export const validTermdbProteomeResponse = createValidate<TermdbProteomeResponse>()
