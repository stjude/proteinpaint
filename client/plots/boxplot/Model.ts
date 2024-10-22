import type { MassAppApi } from '../../mass/types/mass'

type Term = { [index: string]: any }
type DataRequestOpts = { term: Term; term0?: Term; term2?: Term; filter: any; ssid?: string | number }

export class Model {
	config: any
	state: any
	app: MassAppApi
	constructor(config, state, app) {
		this.config = config
		this.state = state
		this.app = app
	}

	async getData() {
		const boxPlotDataArgs: any = {
			tw: this.config.term,
			filter: this.state.termfilter.filter
		}
		if (this.config.term2) boxPlotDataArgs.divideTw = this.config.term2

		const data = await this.app.vocabApi.getBoxPlotData(boxPlotDataArgs)
		return data
	}

	getDataRequestOpts(config, state) {
		const opts: DataRequestOpts = { term: config.term, filter: state.termfilter.filter }
		if (config.term2) opts.term2 = config.term2
		if (config.term0) opts.term0 = config.term0
		if (state.ssid) opts.ssid = state.ssid
		return opts
	}
}
