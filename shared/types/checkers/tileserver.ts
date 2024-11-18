import { createValidate } from 'typia'
import type { TileRequest, TileResponse } from '../src/routes/tileserver.ts'

export { tilePayload } from '../src/routes/tileserver.ts'

export const validTileRequest = createValidate<TileRequest>()
export const validTileResponse = createValidate<TileResponse>()
