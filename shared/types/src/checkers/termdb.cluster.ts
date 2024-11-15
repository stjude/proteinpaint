import { createValidate } from 'typia'
import type { TermdbClusterRequest, TermdbClusterResponse } from '../routes/termdb.cluster.ts'

export { termdbClusterPayload } from '../routes/termdb.cluster.ts'

export const validTermdbClusterRequest = createValidate<TermdbClusterRequest>()
export const validTermdbClusterResponse = createValidate<TermdbClusterResponse>()
