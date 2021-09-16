import * as rx from '../common/rx.core'

class TdbStatTable {
	constructor(opts) {
		this.type = 'stattable'
		this.id = opts.id
		this.app = opts.app
		this.opts = rx.getOpts(opts, this)
		this.api = rx.getComponentApi(this)
		this.dom = {
			div: opts.holder.append('div').style('margin', '10px')
		}
		setRenderers(this)
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			isVisible:
				config.settings.currViews.includes('barchart') &&
				(config.term.term.type == 'float' || config.term.term.type == 'integer') &&
				!config.term.term.noStatTable,
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
			filter: appState.termfilter.filter,
			activeCohort: appState.activeCohort
		}
	}

	main(data) {
		this.config = this.state.config
		if (!this.state.isVisible || !data || !data.boxplot) {
			this.dom.div.style('display', 'none')
			return
		}
		this.render(data)
	}
}

function setRenderers(self) {
	self.render = function(data) {
		// table for statistical summary
		self.dom.div
			.style('display', 'block')
			.selectAll('*')
			.remove()

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

export const statTableInit = rx.getInitFxn(TdbStatTable)
