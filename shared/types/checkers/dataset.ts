// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { DatasetRequest, DatasetResponse } from '../src/routes/dataset.ts'

export { datasetPayload } from '../src/routes/dataset.ts'

export const validDatasetRequest = createValidate<DatasetRequest>()
export const validDatasetResponse = createValidate<DatasetResponse>()
