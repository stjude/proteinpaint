import { getCompInit } from '../rx'

class TdbStatTable {
	constructor(opts) {
		this.type = 'stattable'
	}

	async init() {
		this.dom = {
			div: this.opts.holder.append('div').style('margin', '10px')
		}
		setRenderers(this)
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			activeCohort: appState.activeCohort,
			termfilter: appState.termfilter,
			config: {
				term: config.term,
				term0: config.term0,
				term2: config.term2,
				settings: {
					common: config.settings.common,
					barchart: config.settings.barchart
				}
			},
			filter: appState.termfilter.filter
		}
	}

	async main() {
		try {
			this.config = structuredClone(this.state.config)
			if (this.state.isVisible) {
				const reqOpts = this.getDataRequestOpts()
				const data = await this.app.vocabApi.getNestedChartSeriesData(reqOpts)
				this.app.vocabApi.syncTermData(this.state.config, data)
			}
			if (!this.state.isVisible || !this.data || !this.data.boxplot) {
				this.dom.div.style('display', 'none')
				return
			}
			this.render(this.data)
		} catch (e) {
			throw e
		}
	}

	// creates an opts object for the vocabApi.getNestedChartsData()
	getDataRequestOpts() {
		const c = this.config
		const opts = { term: c.term, filter: this.state.termfilter.filter }
		if (c.term2) opts.term2 = c.term2
		if (c.term0) opts.term0 = c.term0
		if (this.state.ssid) opts.ssid = this.state.ssid
		return opts
	}
}

function setRenderers(self) {
	self.render = function (data) {
		// table for statistical summary
		self.dom.div.style('display', 'block').selectAll('*').remove()

		let exposed_data = ''

		/*
	  if(data.unannotated){
	    exposed_data = '<tr><td colspan="2">Among All Patients</td></tr>'
	    + '<tr><td>'+ plot.unannotated.label_annotated +'</td><td>'+ plot.unannotated.value_annotated +'</td></tr>'
	    + '<tr><td>'+ plot.unannotated.label +'</td><td>'+ plot.unannotated.value +'</td></tr>'
	    + '<tr><td colspan="2">Among Patients treated</td></tr>'
	  }
	  */

		const sd = data.boxplot.sd ? ' (' + data.boxplot.sd.toFixed(2) + ') ' : ''
		let rows = ''
		if (Number.isFinite(data.boxplot.min)) {
			rows += '<tr><td>Minimum</td><td>' + data.boxplot.min.toFixed(2) + '</td></tr>'
		}
		if (Number.isFinite(data.boxplot.max)) {
			rows += '<tr><td>Maximum</td><td>' + data.boxplot.max.toFixed(2) + '</td></tr>'
		}

		rows += '<tr><td>Mean (SD)</td><td>' + data.boxplot.mean.toFixed(2) + sd + '</td></tr>'

		if ('p50' in data.boxplot) {
			rows +=
				'<tr><td>Median (IQR)</td><td>' +
				data.boxplot.p50.toFixed(2) +
				' (' +
				data.boxplot.iqr.toFixed(2) +
				') </td></tr>' +
				'<tr><td>5th Percentile</td><td>' +
				data.boxplot.p05.toFixed(2) +
				'</td></tr>' +
				'<tr><td>25th Percentile</td><td>' +
				data.boxplot.p25.toFixed(2) +
				'</td></tr>' +
				'<tr><td>75th Percentile</td><td>' +
				data.boxplot.p75.toFixed(2) +
				'</td></tr>' +
				'<tr><td>95th Percentile</td><td>' +
				data.boxplot.p95.toFixed(2) +
				'</td></tr>'
		}

		self.dom.div.html('<table><tr><th></th><th>Value</th></tr>' + exposed_data + rows + '</table>')

		self.dom.div
			.selectAll('td, th, table')
			.style('border', '1px solid black')
			.style('padding', '0')
			.style('border-collapse', 'collapse')

		self.dom.div.selectAll('th, td').style('padding', '2px 10px')
	}
}

export const statTableInit = getCompInit(TdbStatTable)
