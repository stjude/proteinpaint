import { createValidate } from 'typia'
import type { DatasetRequest, DatasetResponse } from '../routes/dataset.ts'

export { datasetPayload } from '../routes/dataset.ts'

export const validDatasetRequest = createValidate<DatasetRequest>()
export const validDatasetResponse = createValidate<DatasetResponse>()
