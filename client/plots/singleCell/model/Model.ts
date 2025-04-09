import { dofetch3 } from '#common/dofetch'
import type { TermdbSingleCellDataRequest } from '#types'

export class Model {
	config: any
	state: any

	constructor(state: any) {
		this.state = state
		this.config = state.config
	}

	async getData() {
		const body = this.getRequestBody()
		//TODO: can't use TermdbSingleCellDataResponse type
		// response is a union type that isn't up to date
		const data = await dofetch3('termdb/singlecellData', { body })
		return data
	}

	getRequestBody() {
		const plots = (this.config?.plots || []).filter((p: any) => p.selected).map((p: any) => p.name)
		const body: TermdbSingleCellDataRequest = {
			genome: this.state.genome,
			dslabel: this.state.dslabel,
			plots,
			//filter0 not even used??
			// filter0: this.state.termfilter.filter0,
			// change the sample to contains both sampleID and experimentID, so that they could
			// both be used to query data. (GDC sc gene expression only support sample uuid now)
			// a sample has already been selected
			sample: {
				eID: this.state.config.experimentID,
				sID: this.state.config.sample.Sample
			},
			colorBy: this.state.config.colorBy
		}
		return body
	}
}
