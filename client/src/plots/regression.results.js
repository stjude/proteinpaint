import { q_to_param } from '../termdb/plot'
import { getNormalRoot } from '../common/filter'
import { sayerror } from '../dom/error'

export class RegressionResults {
	constructor(opts) {
		this.opts = opts
		this.app = opts.app
		// reference to the parent component's mutable instance (not its API)
		this.parent = opts.parent
		this.type = 'regression'
		setInteractivity(this)
		setRenderers(this)
		const holder = this.opts.holder
		this.dom = {
			holder,
			header: holder
				.append('div')
				.style('margin', '30px 0 10px 0px')
				.style('font-size', '17px')
				.style('padding', '3px 5px')
				.style('color', '#bbb')
				.html('Results'),
			err_div: holder.append('div'),
			content: holder.append('div').style('margin', '10px')
		}
	}

	async main() {
		try {
			this.parent.inputs.dom.submitBtn.text('Running...')
			// share the writable config copy
			this.config = this.parent.config
			this.state = this.parent.state
			if (!this.state.formIsComplete || this.parent.inputs.hasError || this.config.hasUnsubmittedEdits) {
				this.dom.holder.style('display', 'none')
				return
			}
			const dataName = this.getDataName()
			const data = await this.app.vocabApi.getPlotData(this.id, dataName)
			if (data.error) throw data.error
			this.dom.err_div.style('display', 'none')
			this.dom.content.selectAll('*').remove()
			this.dom.holder.style('display', 'block')
			this.displayResult(data)
		} catch (e) {
			this.hasError = true
			this.dom.holder.style('display', 'block')
			this.dom.err_div.style('display', 'block')
			sayerror(this.dom.err_div, 'Error: ' + (e.error || e))
			this.parent.inputs.dom.submitBtn.property('disabled', true)
			console.error(e)
		}
	}

	// creates URL search parameter string, that also serves as
	// a unique request identifier to be used for caching server response
	getDataName() {
		const c = this.config // the plot object in state
		const outcome = { id: c.outcome.id, q: JSON.parse(JSON.stringify(c.outcome.q)) }
		if (!outcome.q.mode && c.regressionType == 'linear') outcome.q.mode = 'continuous'
		const contQkeys = ['mode', 'scale']
		outcome.refGrp = outcome.q.mode == 'continuous' ? 'NA' : c.outcome.refGrp

		if (outcome.q.mode == 'continuous') {
			// remove unneeded parameters from q
			for (const key in outcome.q) {
				if (!contQkeys.includes(key)) delete outcome.q[key]
			}
		}

		const params = [
			'getregression=1',
			`regressionType=${c.regressionType}`,
			`outcome=${encodeURIComponent(JSON.stringify(outcome))}`,
			'independent=' +
				encodeURIComponent(
					JSON.stringify(
						c.independent.map(t => {
							const q = JSON.parse(JSON.stringify(t.q))
							delete q.values
							delete q.totalCount
							if (t.q.mode == 'continuous') {
								// remove unneeded parameters from q
								for (const key in q) {
									if (!contQkeys.includes(key)) delete q[key]
								}
							}
							return {
								id: t.id,
								q,
								type: t.term.type,
								refGrp: t.q.mode == 'continuous' ? 'NA' : t.refGrp
							}
						})
					)
				)
		]

		const filterData = getNormalRoot(this.state.termfilter.filter)
		if (filterData.lst.length) {
			params.push('filter=' + encodeURIComponent(JSON.stringify(filterData))) //encodeNestedFilter(state.termfilter.filter))
		}
		return '/termdb?' + params.join('&')
	}
}

function setInteractivity(self) {
	self.download = () => {
		if (!self.state || !self.state.isVisible) return
		const data = []
		self.dom.content.selectAll('tr').each(function() {
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

		if (result.residuals) {
			const div = sectionHolder(result.residuals.label)
			const table = div.append('table').style('border-spacing', '8px')
			const tr1 = table.append('tr').style('opacity', 0.4)
			const tr2 = table.append('tr')
			for (const v of result.residuals.lst) {
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
					const orderedCategories = []
					const input = self.parent.inputs.independent.inputs.find(i => i[i.varClass].id == tid)
					if (input.handler.valuesTable.orderedLabels) {
						// reorder rows by predefined order
						for (const k of input.handler.valuesTable.orderedLabels) {
							if (termdata.categories[k]) orderedCategories.push(k)
						}
					}
					for (const k in termdata.categories) {
						if (!orderedCategories.includes(k)) orderedCategories.push(k)
					}

					// multiple categories
					// show first category as full row, with first cell spanning rest of categories
					termnametd.attr('rowspan', orderedCategories.length).style('vertical-align', 'top')

					let isfirst = true
					for (const k of orderedCategories) {
						if (isfirst) {
							isfirst = false
						} else {
							// create new row starting from 2nd category
							tr = table.append('tr').style('background', rowcount++ % 2 ? '#eee' : 'none')
						}
						tr.append('td')
							.text(term && term.term.values && term.term.values[k] ? term.term.values[k].label : k)
							.style('padding', '8px')
						for (const v of termdata.categories[k]) {
							tr.append('td')
								.text(v)
								.style('padding', '8px')
						}
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
		if (result.other) {
			const div = sectionHolder(result.other.label)
			const table = div.append('table').style('border-spacing', '8px')
			for (const [k, v] of result.other.lst) {
				const tr = table.append('tr')
				tr.append('td')
					.style('opacity', 0.4)
					.text(k)
				tr.append('td').text(v)
			}
		}
		function sectionHolder(label) {
			const div = self.dom.content.append('div').style('margin', '20px 0px 10px 0px')

			div
				.append('div')
				.style('text-decoration', 'underline')
				.text(label)
			return div.append('div').style('margin-left', '20px')
		}
	}
}
