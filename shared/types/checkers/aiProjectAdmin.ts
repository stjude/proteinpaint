// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { AIProjectAdminRequest, AIProjectAdminResponse } from '../src/routes/aiProjectAdmin.ts'

export { aiProjectAdminPayload } from '../src/routes/aiProjectAdmin.ts'

export const validAIProjectAdminRequest = createValidate<AIProjectAdminRequest>()
export const validAIProjectAdminResponse = createValidate<AIProjectAdminResponse>()
