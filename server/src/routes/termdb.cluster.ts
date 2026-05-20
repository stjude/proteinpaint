import type { RoutePayload } from '#types'

export const termdbClusterPayload: RoutePayload = {
	request: { typeId: 'TermdbClusterRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'TermdbClusterResponse' }
}
