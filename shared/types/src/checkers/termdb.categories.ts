import { createValidate } from 'typia'
import type { CategoriesRequest, CategoriesResponse } from '../routes/termdb.categories.ts'

export { termdbCategoriesPayload } from '../routes/termdb.categories.ts'

export const validCategoriesRequest = createValidate<CategoriesRequest>()
export const validCategoriesResponse = createValidate<CategoriesResponse>()
