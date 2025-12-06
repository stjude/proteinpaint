// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type {
	DeleteWSITileSelectionRequest,
	DeleteWSITileSelectionResponse
} from '../src/routes/deleteWSITileSelection.ts'

export { deleteWSITileSelectionPayload } from '../src/routes/deleteWSITileSelection.ts'

export const validDeleteWSITileSelectionRequest = createValidate<DeleteWSITileSelectionRequest>()
export const validDeleteWSITileSelectionResponse = createValidate<DeleteWSITileSelectionResponse>()
