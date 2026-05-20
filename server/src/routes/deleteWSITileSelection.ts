import type { RouteApi } from '#types'
import { deleteWSITileSelectionPayload } from '#types/checkers'
import { init } from '../../routes/deleteWSITileSelection.ts'

export const api: RouteApi = {
	endpoint: `deleteWSITileSelection`,
	methods: {
		delete: {
			...deleteWSITileSelectionPayload,
			init
		}
	}
}
