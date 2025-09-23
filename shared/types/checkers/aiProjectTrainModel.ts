// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { AIProjectTrainModelRequest, AIProjectTrainModelResponse } from '../src/routes/aiProjectTrainModel.ts'

export { aiProjectTrainModelPayload } from '../src/routes/aiProjectTrainModel.ts'

export const validAIProjectTrainModelRequest = createValidate<AIProjectTrainModelRequest>()
export const validAIProjectTrainModelResponse = createValidate<AIProjectTrainModelResponse>()
