import { createValidate } from 'typia'
import type { DescrStatsRequest, DescrStatsResponse } from '../src/routes/termdb.descrstats.ts'

export { descrStatsPayload } from '../src/routes/termdb.descrstats.ts'

export const validDescrStatsRequest = createValidate<DescrStatsRequest>()
export const validDescrStatsResponse = createValidate<DescrStatsResponse>()
