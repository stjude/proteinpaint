// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { ChatRequest, ChatResponse } from '../src/routes/termdb.chat.ts'

export { ChatPayload } from '../src/routes/termdb.chat.ts'

export const validChatRequest = createValidate<ChatRequest>()
export const validChatResponse = createValidate<ChatResponse>()
