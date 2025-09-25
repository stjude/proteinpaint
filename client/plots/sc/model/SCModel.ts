import type { AppApi } from '#rx'
import type { SCFormattedState } from '../SCTypes'
import { dofetch3 } from '#common/dofetch'

/** Fetches data for sc app */
export class SCModel {
	app: AppApi
	id?: string
	state: SCFormattedState

	constructor(app: AppApi, id: string) {
		this.app = app
		this.id = id
		//Should only use immutable state attributes (e.g. vocab.genome)
		this.state = this.app.getState()
	}

	/********** Single Cell SAMPLES for rendering the table *********/
	//The table data does not update
	//Should only need to init once
	async getSampleData() {
		const body = this.getSampleRequestOpts()
		return await dofetch3('termdb/singlecellSamples', { body })
	}

	//May involve more complicated logic later
	getSampleRequestOpts() {
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
				 * analysis.workflow_type as 'Library', but this is not a term
				 * in gdc dictionary */
			}
			col.label = label
		}
		return colsCopy
	}

	/********** Single Cell DATA for rendering plots *********/
	async getData() {
		const body = this.getDataRequestOpts()
		if (!body) return
		return await dofetch3('termdb/singlecellData', { body })
	}

	getDataRequestOpts() {
		const state = this.app.getState()
		const singleCellTermdbConfig = state.termdbConfig?.queries?.singleCell
		if (!singleCellTermdbConfig?.data)
			throw 'No singleCell.data defined in termdbConfig.queries [SC Model getDataRequestOpts()]'

		const config = state.plots.find((p: any) => p.id === this.id)
		if (!config.settings.sc.item) return

		//TODO: May need to only use active plots for this sample
		const plots = singleCellTermdbConfig.data.plots.map(p => p.name)

		return {
			genome: this.state.vocab.genome,
			dslabel: this.state.vocab.dslabel,
			plots,
			sample: {
				eID: config.settings.sc.item.experiment,
				sID: config.settings.sc.item.sample
			}
		}
	}
}
