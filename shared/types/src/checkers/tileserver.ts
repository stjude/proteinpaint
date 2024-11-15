import { createValidate } from 'typia'
import type { TileRequest, TileResponse } from '../routes/tileserver.ts'

export { tilePayload } from '../routes/tileserver.ts'

export const validTileRequest = createValidate<TileRequest>()
export const validTileResponse = createValidate<TileResponse>()
