import type { RouteApi } from '#types'
import { gdcGRIN2listPayload } from '#types/checkers'
import { init } from '../../routes/gdc.grin2.list.ts'

export const api: RouteApi = {
	endpoint: 'gdc/GRIN2list',
	methods: {
		get: {
			...gdcGRIN2listPayload,
			init
		},
		post: {
			...gdcGRIN2listPayload,
			init
		}
	}
}
