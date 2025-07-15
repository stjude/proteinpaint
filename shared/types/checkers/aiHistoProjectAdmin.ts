// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { AIHistoProjectAdminRequest, AIHistoProjectAdminResponse } from '../src/routes/aiHistoProjectAdmin.ts'

export { aiHistoProjectAdminPayload } from '../src/routes/aiHistoProjectAdmin.ts'

export const validAIHistoProjectAdminRequest = createValidate<AIHistoProjectAdminRequest>()
export const validAIHistoProjectAdminResponse = createValidate<AIHistoProjectAdminResponse>()
