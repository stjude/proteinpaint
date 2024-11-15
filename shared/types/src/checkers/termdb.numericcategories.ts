import { createValidate } from 'typia'
import type { NumericCategoriesRequest, NumericCategoriesResponse } from '../routes/termdb.numericcategories.ts'

export { numericCategoriesPayload } from '../routes/termdb.numericcategories.ts'

export const validNumericCategoriesRequest = createValidate<NumericCategoriesRequest>()
export const validNumericCategoriesResponse = createValidate<NumericCategoriesResponse>()
