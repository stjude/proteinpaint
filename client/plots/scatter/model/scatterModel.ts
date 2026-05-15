import type { Scatter } from '../scatter'
import type { ScatterResponse, ScatterDataResult } from '../scatterTypes'
import { ScatterModelBase } from './ScatterModelBase'
// Re-export shapes for consumers that import from this module
export { shapes } from './ScatterModelBase'

export class ScatterModel extends ScatterModelBase {
	constructor(scatter: Scatter) {
		super(scatter)
	}

	// creates an opts object for the vocabApi.someMethod(),
	// may need to add a new method to client/termdb/vocabulary.js
	// for now, just add methods to TermdbVocab,
	// later on, add methods with same name to FrontendVocab
	getDataRequestOpts() {
		const c: any = this.scatter.config

		const coordTWs: any = []
		if (c.term) coordTWs.push(c.term)
		if (c.term2) coordTWs.push(c.term2)
		//If filter is provided in the config use it. The config filter includes the term filter, used by the report plot
		const filter = this.scatter.parentId ? this.scatter.state.termfilter.filter : this.scatter.getFilter()
		const opts: any = {
			name: c.name, // the actual identifier of the plot, for retrieving data from server
			colorTW: c.colorTW,
			filter,
			coordTWs,
			chartType: this.scatter.type,
			excludeOutliers: this.scatter.settings.excludeOutliers
		}
		if (this.scatter.state.termfilter.filter0) opts.filter0 = this.scatter.state.termfilter.filter0
		if (c.colorColumn) opts.colorColumn = c.colorColumn
		if (c.shapeTW) opts.shapeTW = c.shapeTW
		if (c.scaleDotTW) {
			if (!c.scaleDotTW.q) c.scaleDotTW.q = {}
			c.scaleDotTW.q.mode = 'continuous'
			opts.scaleDotTW = c.scaleDotTW
		}
		if (c.term0) opts.divideByTW = c.term0

		return opts
	}

	async initData() {
		try {
			const reqOpts = this.getDataRequestOpts()
			if (reqOpts.coordTWs?.length == 1 && this.scatter.type == 'sampleScatter') return //To allow removing a term in the controls, though nothing is rendered (summary tab with violin active)

			const data: ScatterResponse = await this.scatter.app.vocabApi.getScatterData(
				reqOpts,
				this.scatter.api?.getAbortSignal()
			)
			if ('error' in data || !data.result) throw new Error(data['error'] || 'No data received')

			this.range = data.range
			for (const [key, chartData] of Object.entries(data.result)) {
				const chart = chartData as ScatterDataResult
				// if (!Array.isArray(chart.samples)) throw 'data.samples[] not array'
				this.createChart(key, chart)
			}

			this.is3D = this.scatter.config.term0?.q.mode == 'continuous'
			this.initRanges()
		} catch (e: any) {
			if (this.scatter.app.isAbortError(e)) return
			console.error(e)
			throw e.message || e
		}
	}
}
