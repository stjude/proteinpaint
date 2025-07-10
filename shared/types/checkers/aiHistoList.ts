// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { AIHistoListRequest, AIHistoListResponse } from '../src/routes/aiHistoList.ts'

export { aiHistoListPayload } from '../src/routes/aiHistoList.ts'

export const validAIHistoListRequest = createValidate<AIHistoListRequest>()
export const validAIHistoListResponse = createValidate<AIHistoListResponse>()
