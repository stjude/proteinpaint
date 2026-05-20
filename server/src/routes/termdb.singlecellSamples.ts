import type { RoutePayload, RouteApi } from '#types'
import { init } from '../../routes/termdb.singlecellSamples.ts'

export const payload: RoutePayload = {
	init,
	request: { typeId: 'TermdbSingleCellSamplesRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'TermdbSingleCellSamplesResponse' }
}

/* route returns list of samples with sc data
this is due to the fact that sometimes not all samples in a dataset has sc data
*/

export const api: RouteApi = {
	endpoint: 'termdb/singlecellSamples',
	methods: {
		get: payload,
		post: payload
	}
}
