import type { RoutePayload } from '#types'

export const termdbCohortSummaryPayload: RoutePayload = {
	request: { typeId: 'TermdbCohortSummaryRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'TermdbCohortSummaryResponse' }
}
