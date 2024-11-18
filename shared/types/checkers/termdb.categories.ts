import { createValidate } from 'typia'
import type { CategoriesRequest, CategoriesResponse } from '../src/routes/termdb.categories.ts'

export { termdbCategoriesPayload } from '../src/routes/termdb.categories.ts'

export const validCategoriesRequest = createValidate<CategoriesRequest>()
export const validCategoriesResponse = createValidate<CategoriesResponse>()
