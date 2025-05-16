// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { TermdbClusterRequest, TermdbClusterResponse } from '../src/routes/termdb.cluster.ts'

export { termdbClusterPayload } from '../src/routes/termdb.cluster.ts'

export const validTermdbClusterRequest = createValidate<TermdbClusterRequest>()
export const validTermdbClusterResponse = createValidate<TermdbClusterResponse>()
