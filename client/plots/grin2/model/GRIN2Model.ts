import type { GRIN2RequestData, GRIN2Response } from '../GRIN2Types'

/** Server-interaction layer for the GRIN2 plot.
 *  Wraps the vocabApi getter so the controller stays free of fetch concerns. */
export class GRIN2Model {
	private vocabApi: any

	constructor(vocabApi: any) {
		this.vocabApi = vocabApi
	}

	async fetchGrin2Data(requestData: GRIN2RequestData, signal?: AbortSignal): Promise<GRIN2Response> {
		return this.vocabApi.getGrin2Data(requestData, signal)
	}
}
