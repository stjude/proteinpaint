import type { RouteApi } from '#types'
import { violinBoxPayload } from '#types/checkers'
import { init } from '../../routes/termdb.violinBox.ts'

export const api: RouteApi = {
	endpoint: 'termdb/violinBox',
	methods: {
		get: {
			...violinBoxPayload,
			init
		},
		post: {
			...violinBoxPayload,
			init
		}
	}
}
