import { createValidate } from 'typia'
import type { DatasetRequest, DatasetResponse } from '../src/routes/dataset.ts'

export { datasetPayload } from '../src/routes/dataset.ts'

export const validDatasetRequest = createValidate<DatasetRequest>()
export const validDatasetResponse = createValidate<DatasetResponse>()
