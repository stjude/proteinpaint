import { createValidate } from 'typia'
import type { DescrStatsRequest, DescrStatsResponse } from '../routes/termdb.descrstats.ts'

export { descrStatsPayload } from '../routes/termdb.descrstats.ts'

export const validDescrStatsRequest = createValidate<DescrStatsRequest>()
export const validDescrStatsResponse = createValidate<DescrStatsResponse>()
