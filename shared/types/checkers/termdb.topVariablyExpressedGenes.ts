import { createValidate } from 'typia'
import type {
	TermdbTopVariablyExpressedGenesRequest,
	TermdbTopVariablyExpressedGenesResponse
} from '../src/routes/termdb.topVariablyExpressedGenes.ts'

export { termdbTopVariablyExpressedGenesPayload } from '../src/routes/termdb.topVariablyExpressedGenes.ts'

export const validTermdbTopVariablyExpressedGenesRequest = createValidate<TermdbTopVariablyExpressedGenesRequest>()
export const validTermdbTopVariablyExpressedGenesResponse = createValidate<TermdbTopVariablyExpressedGenesResponse>()
