import { createValidate } from 'typia'
import type {
	TermdbGetImageFromPathRequest,
	TermdbGetImageFromPathResponse
} from '../src/routes/termdb.getImageFromPath.ts'

export { termdbGetImageFromPathPayload } from '../src/routes/termdb.getImageFromPath.ts'

export const validTermdbGetImageFromPathRequest = createValidate<TermdbGetImageFromPathRequest>()
export const validTermdbGetImageFromPathResponse = createValidate<TermdbGetImageFromPathResponse>()
