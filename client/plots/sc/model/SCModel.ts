import type { MassAppApi } from '#mass/types/mass'
import type { SCState } from '../SCTypes'
import { dofetch3 } from '#common/dofetch'

/** Fetches data for sc app */
export class SCModel {
	app: MassAppApi
	state: SCState

	constructor(app: MassAppApi) {
		this.app = app
		this.state = this.app.getState()
	}

	//The table data does not update
	//Should only need to init once
	async getSampleData() {
		const body = this.getRequestOpts()
		return await dofetch3('termdb/singlecellSamples', { body })
	}

	//May involve more complicated logic later
	getRequestOpts() {
		return {
			genome: this.state.vocab.genome,
			dslabel: this.state.vocab.dslabel,
			filter0: this.state.termfilter.filter0 || null
		}
	}

	//Fetches optional name for ds defined columns
	async getColumnLabels(dsScSamples: { [key: string]: any }) {
		if (!dsScSamples || !dsScSamples.sampleColumns) return
		const colsCopy = structuredClone(dsScSamples.sampleColumns)
		for (const col of colsCopy) {
			col.label = (await this.app.vocabApi.getterm(col.termid)).name
		}
		return colsCopy
	}
}
