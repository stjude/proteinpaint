import type { RoutePayload, RouteApi } from '#types'
import { init } from '../../routes/gdc.mafBuild.ts'

export const GdcMafPayload: RoutePayload = {
	init,
	request: { typeId: 'GdcMafBuildRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'GdcMafBuildResponse' }
}

export const api: RouteApi = {
	endpoint: 'gdc/mafBuild',
	methods: {
		get: GdcMafPayload,
		post: GdcMafPayload
	}
}
