type Term = { [index: string]: any }
type DataRequestOpts = { term: Term; term0?: Term; term2?: Term; filter: any; ssid?: string | number }

export class Model {
	config: any
	state: any
	app: any
	constructor(config, state, app) {
		this.config = config
		this.state = state
		this.app = app
	}

	async getData() {
		const reqOpts = this.getDataRequestOpts(this.config, this.state)
		// const result = await this.app.vocabApi.getNestedChartSeriesData(reqOpts)
		// const data2 = result.data
		// this.app.vocabApi.syncTermData(this.config, data2)

		const boxPlotDataArgs: any = {
			tw: this.config.term,
			filter: this.state.termfilter.filter
		}
		if (this.config.term2) boxPlotDataArgs.divideTw = this.config.term2

		const data = await this.app.vocabApi.getBoxPlotData(boxPlotDataArgs)
		this.app.vocabApi.syncTermData(this.config, data)
		// console.log(25, 'getBoxPlotData', data)
		return data
	}

	getDataRequestOpts(config, state) {
		const opts: DataRequestOpts = { term: config.term, filter: state.termfilter.filter }
		if (config.term2) opts.term2 = config.term2
		if (config.term0) opts.term0 = config.term0
		if (state.ssid) opts.ssid = state.ssid
		return opts
	}

	// processData(data) {
	// 	let binmax = 0
	// 	const lst = data.refs.cols.map(t1 => {
	// 		const d = data.charts[0].serieses.find(d => d.seriesId == t1)
	// 		if (!d) return null
	// 		if (binmax < d.max) binmax = d.max
	// 		return {
	// 			label: t1,
	// 			value: d.total,
	// 			boxplot: d.boxplot
	// 		}
	// 	})
	// 	return [lst, binmax]
	// }
}
