// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { AIProjectListRequest, AIProjectListResponse } from '../src/routes/aiProjectList.ts'

export { aiProjectListPayload } from '../src/routes/aiProjectList.ts'

export const validAIProjectListRequest = createValidate<AIProjectListRequest>()
export const validAIProjectListResponse = createValidate<AIProjectListResponse>()
