import { createValidate } from 'typia'
import type { TermdbClusterRequest, TermdbClusterResponse } from '../src/routes/termdb.cluster.ts'

export { termdbClusterPayload } from '../src/routes/termdb.cluster.ts'

export const validTermdbClusterRequest = createValidate<TermdbClusterRequest>()
export const validTermdbClusterResponse = createValidate<TermdbClusterResponse>()
