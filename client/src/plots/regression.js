import { regressionUIInit } from './regression.ui'
import { getCompInit } from '../common/rx.core'
import { select } from 'd3-selection'
import { q_to_param } from '../termdb/plot'
import { getNormalRoot } from '../common/filter'
import { sayerror } from '../client'

class MassRegression {
	constructor(opts) {
		this.type = 'regression'
		setInteractivity(this)
		setRenderers(this)
	}

	async init() {
		this.opts.holder.style('margin-left', 0)
		const controls = this.opts.holder.append('div')
		const banner = this.opts.holder
			.append('div')
			.style('color', '#bbb')
			.style('display', 'none')
			.style('margin', '10px')
		const resultsDiv = this.opts.holder.append('div').style('margin-left', '40px')

		this.dom = {
			controls,
			header: this.opts.header,
			banner,
			resultsHeading: resultsDiv
				.append('div')
				.style('margin', '30px 0 10px 0px')
				.style('font-size', '17px')
				.style('padding', '3px 5px')
				.style('color', '#bbb')
				.html('Results'),

			div: resultsDiv.append('div').style('margin', '10px') //.style('display', 'none')
		}

		this.components = {
			controls: await regressionUIInit({
				app: this.app,
				id: this.id,
				holder: this.dom.controls,
				chart: this.api
				/*callbacks: {
					'downloadClick.regression': this.download
				}*/
			})
		}
	}

	getState(appState, sub) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		if (!config.regressionType) throw 'regressionType is required'
		return {
			isVisible: config.settings && config.settings.currViews.includes('regression'),
			formIsComplete: config.term && config.independent.length,
			activeCohort: appState.activeCohort,
			termfilter: appState.termfilter,
			config: {
				term: config.term,
				regressionType: config.regressionType,
				independent: config.independent,
				settings: {
					table: config.settings && config.settings.regression
				}
			}
		}
	}

	async main() {
		try {
			//if (!this.state.config.term) return
			this.config = JSON.parse(JSON.stringify(this.state.config))
			if (this.dom.header) {
				const regressionType = this.config.regressionType
				const text = regressionType.charAt(0).toUpperCase() + regressionType.slice(1) + ' Regression'
				this.dom.header.html(text)
			}
			if (!this.state.isVisible) {
				this.dom.div.style('display', 'none')
				this.dom.resultsHeading.style('display', 'none')
				return
			}
			if (!this.config.independent.length || !this.config.term) {
				this.dom.div.style('display', 'none')
				this.dom.resultsHeading.style('display', 'none')
				// will only show the regression controls when outcome and/or independent terms are empty
				return
			}
			this.dom.div.selectAll('*').remove()
			this.dom.banner.style('display', this.state.formIsComplete ? 'block' : 'none')
			const dataName = this.getDataName()
			const data = await this.app.vocabApi.getPlotData(this.id, dataName)
			this.dom.banner.style('display', 'none').html('')
			this.dom.div.style('display', 'block')
			this.dom.resultsHeading.style('display', 'block')
			this.displayResult(data)
		} catch (e) {
			//this.dom.banner.style('display', 'block').html(e.error || e)
			sayerror(this.dom.banner.style('display', 'block'), 'Error: ' + (e.error || e))
		}
	}

	// creates URL search parameter string, that also serves as
	// a unique request identifier to be used for caching server response
	getDataName() {
		const c = this.config // the plot object in state
		const params = ['getregression=1', 'term1_id=' + encodeURIComponent(c.term.term.id)]
		if (c.regressionType == 'logistic') {
			params.push('term1_q=' + q_to_param(c.term.q))
			params.push('regressionType=logistic')
		} else {
			// TODO: need to add q.scale, why is the mode not set via termsetting callback
			params.push('term1_q=' + encodeURIComponent(JSON.stringify({ mode: 'continuous' })))
			params.push('regressionType=linear')
		}

		params.push(
			'independent=' +
				encodeURIComponent(
					JSON.stringify(
						c.independent.map(t => {
							const q = JSON.parse(JSON.stringify(t.q))
							delete q.values
							delete q.totalCount
							return { id: t.id, q: t.q, type: t.term.type }
						})
					)
				)
		)

		const filterData = getNormalRoot(this.state.termfilter.filter)
		if (filterData.lst.length) {
			params.push('filter=' + encodeURIComponent(JSON.stringify(filterData))) //encodeNestedFilter(state.termfilter.filter))
		}
		return '/termdb?' + params.join('&')
	}
}

export const regressionInit = getCompInit(MassRegression)
// this alias will allow abstracted dynamic imports
export const componentInit = regressionInit

function setInteractivity(self) {
	self.download = () => {
		if (!self.state || !self.state.isVisible) return
		const data = []
		self.dom.div.selectAll('tr').each(function() {
			const series = []
			select(this)
				.selectAll('th, td')
				.each(function() {
					series.push(select(this).text())
				})
			data.push(series)
		})
		const matrix = data.map(row => row.join('\t')).join('\n')

		const a = document.createElement('a')
		document.body.appendChild(a)
		a.addEventListener(
			'click',
			function() {
				a.download = self.config.term.term.name + ' table.txt'
				a.href = URL.createObjectURL(new Blob([matrix], { type: 'text/tab-separated-values' }))
				document.body.removeChild(a)
			},
			false
		)
		a.click()
	}
}

function setRenderers(self) {
	self.displayResult = function(result) {
		// this is work-in-progress and will be redeveloped later
		// hardcoded logic and data structure
		// benefit is that specific logic can be applied to rendering each different table
		// no need for one reusable renderer to support different table types

		sectionHolder('Sample size: ' + result.sampleSize)

		if (result.warnings) {
			const div = sectionHolder(result.warnings.label)
			//const p = div.append('p').style('margin', '8px')
			div.append('div').style('margin', '8px')
			for (const line of result.warnings.lst) {
				div
					.append('p')
					.style('margin', '5px')
					.text(line)
			}
		}

		if (result.devianceResiduals) {
			const div = sectionHolder(result.devianceResiduals.label)
			const table = div.append('table').style('border-spacing', '8px')
			const tr1 = table.append('tr').style('opacity', 0.4)
			const tr2 = table.append('tr')
			for (const v of result.devianceResiduals.lst) {
				tr1.append('td').text(v[0])
				tr2.append('td').text(v[1])
			}
		}

		if (result.coefficients) {
			const div = sectionHolder(result.coefficients.label)
			const table = div.append('table').style('border-spacing', '0px')

			// padding is set on every <td>. need a better solution

			// header
			{
				const tr = table.append('tr').style('opacity', 0.4)
				tr.append('td')
					.text('Variable')
					.style('padding', '8px')
				tr.append('td')
					.text('Category')
					.style('padding', '8px')
				for (const v of result.coefficients.header) {
					tr.append('td')
						.text(v)
						.style('padding', '8px')
				}
			}
			// intercept
			{
				const tr = table.append('tr').style('background', '#eee')
				tr.append('td')
					.text('(Intercept)')
					.style('padding', '8px')
				tr.append('td').style('padding', '8px')
				for (const v of result.coefficients.intercept) {
					tr.append('td')
						.text(v)
						.style('padding', '8px')
				}
			}
			// independent terms
			let rowcount = 0
			for (const tid in result.coefficients.terms) {
				const termdata = result.coefficients.terms[tid]
				const term = self.state.config.independent.find(t => t.id == tid)
				let tr = table.append('tr').style('background', rowcount++ % 2 ? '#eee' : 'none')
				// term name
				const termnametd = tr
					.append('td')
					.text(term ? term.term.name : tid)
					.style('padding', '8px')

				if (termdata.fields) {
					// no category
					tr.append('td')
					for (const v of termdata.fields)
						tr.append('td')
							.text(v)
							.style('padding', '8px')
				} else if (termdata.categories) {
					// multiple categories. show first category as full row, with first cell spanning rest of categories

					const categories = []
					for (const k in termdata.categories) categories.push(k)
					// TODO sort categories array by orderedLabels, after deleting sorting code from R

					termnametd.attr('rowspan', categories.length).style('vertical-align', 'top')
					let isfirst = true
					for (const k in termdata.categories) {
						if (isfirst) {
							isfirst = false
						} else {
							// create new row starting from 2nd category
							tr = table.append('tr').style('background', rowcount++ % 2 ? '#eee' : 'none')
						}
						tr.append('td')
							.text(term && term.term.values && term.term.values[k] ? term.term.values[k].label : k)
							.style('padding', '8px')
						for (const v of termdata.categories[k])
							tr.append('td')
								.text(v)
								.style('padding', '8px')
					}
				} else {
					tr.append('td').text('ERROR: no .fields[] or .categories{}')
				}
			}
		}

		if (result.type3) {
			const div = sectionHolder(result.type3.label)
			const table = div.append('table').style('border-spacing', '8px')
			// header
			{
				const tr = table.append('tr').style('opacity', 0.4)
				for (const v of result.type3.header) {
					tr.append('td').text(v)
				}
			}
			for (const row of result.type3.lst) {
				const tr = table.append('tr')
				const v1 = row.shift()
				const td = tr.append('td')
				if (v1) {
					const term = self.state.config.independent.find(t => t.id == v1)
					td.text(term ? term.term.name : v1)
				}
				for (const v of row) tr.append('td').text(v)
			}
		}
		if (result.otherSummary) {
			const div = sectionHolder(result.otherSummary.label)
			const table = div.append('table').style('border-spacing', '8px')
			for (const [k, v] of result.otherSummary.lst) {
				const tr = table.append('tr')
				tr.append('td')
					.style('opacity', 0.4)
					.text(k)
				tr.append('td').text(v)
			}
		}
		function sectionHolder(label) {
			const div = self.dom.div.append('div').style('margin', '20px 0px 10px 0px')

			div
				.append('div')
				.style('text-decoration', 'underline')
				.text(label)
			return div.append('div').style('margin-left', '20px')
		}
	}
}
