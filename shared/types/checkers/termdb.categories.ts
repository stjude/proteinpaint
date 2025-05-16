// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { CategoriesRequest, CategoriesResponse } from '../src/routes/termdb.categories.ts'

export { termdbCategoriesPayload } from '../src/routes/termdb.categories.ts'

export const validCategoriesRequest = createValidate<CategoriesRequest>()
export const validCategoriesResponse = createValidate<CategoriesResponse>()
