import type { AppApi } from '#rx'
import type { SCState } from '../SCTypes'
import { dofetch3 } from '#common/dofetch'

/** Fetches data for sc app */
export class SCModel {
	app: AppApi
	state: SCState

	constructor(app: AppApi) {
		this.app = app
		//Should only use immutable state attributes (e.g. vocab.genome)
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
			let label = col.termid
			try {
				label = (await this.app.vocabApi.getterm(col.termid)).name
			} catch (e: any) {
				if (e.message) {
					//Ignore. if statement to prevent tsc error.
				}
				/** Ignore errors and use the termid as the column header.
				 * this is due to practical constrain that gdc needs to supply
				 * analysis.workflow_type as 'Library',but this is not a term in gdc dictionary*/
			}
			col.label = label
		}
		return colsCopy
	}
}
