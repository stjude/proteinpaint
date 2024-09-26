import { createValidate } from 'typia'
import { BurdenRequest, BurdenResponse } from './src/routes/burden.js'

// const req: BurdenRequest = {
// 	genome: 'hg38'
// }

export const validBurdenRequest = createValidate<BurdenRequest>()
export const validBurdenResponse = createValidate<BurdenResponse>()
