import { getNormalRoot } from '../common/filter'
import { sayerror } from '../dom/error'

const refGrp_NA = 'NA' // refGrp value is not applicable, hardcoded for R

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
			const reqOpts = this.getDataRequestOpts()
			const data = await this.app.vocabApi.getRegressionData(reqOpts)
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

	// creates an opts object for the vocabApi.getRegressionData()
	getDataRequestOpts() {
		const c = this.config
		const opts = {
			regressionType: c.regressionType,
			outcome: c.outcome,
			independent: c.independent,
			filter: this.state.termfilter.filter
		}
		return opts
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

		self.newDiv('Sample size: ' + result.sampleSize)
		self.mayshow_warnings(result)
		self.mayshow_residuals(result)
		self.mayshow_coefficients(result)
		self.mayshow_type3(result)
		self.mayshow_other(result)
	}
	self.newDiv = label => {
		// create div to show a section of the result
		const div = self.dom.content.append('div').style('margin', '20px 0px 10px 0px')
		div
			.append('div')
			.style('text-decoration', 'underline')
			.text(label)
		return div.append('div').style('margin-left', '20px')
	}

	self.mayshow_warnings = result => {
		if (!result.warnings) return
		const div = self.newDiv(result.warnings.label)
		div.append('div').style('margin', '8px')
		for (const line of result.warnings.lst) {
			div
				.append('p')
				.style('margin', '5px')
				.text(line)
		}
	}

	self.mayshow_residuals = result => {
		if (!result.residuals) return
		const div = self.newDiv(result.residuals.label)
		const table = div.append('table').style('border-spacing', '8px')
		const tr1 = table.append('tr').style('opacity', 0.4)
		const tr2 = table.append('tr')
		for (const v of result.residuals.lst) {
			tr1.append('td').text(v[0])
			tr2.append('td').text(v[1])
		}
	}

	self.mayshow_type3 = result => {
		if (!result.type3) return
		const div = self.newDiv(result.type3.label)
		const table = div.append('table').style('border-spacing', '0px')
		// header
		{
			const tr = table.append('tr').style('opacity', 0.4)
			for (const v of result.type3.header) {
				tr.append('td')
					.text(v)
					.style('padding', '8px')
			}
		}
		let rowcount = 1
		for (const row of result.type3.lst) {
			const tr = table.append('tr').style('background', rowcount++ % 2 ? '#eee' : 'none')
			// column 1 for variable
			const td = tr.append('td').style('padding', '8px')
			if (row.id1) {
				const term1 = self.state.config.independent.find(t => t.id == row.id1)
				fillTdName(td.append('div'), term1 ? term1.term.name : row.id1)
				if (row.id2) {
					const term2 = self.state.config.independent.find(t => t.id == row.id2)
					fillTdName(td.append('div'), term2 ? term2.term.name : row.id2)
				}
			}
			for (const v of row.lst)
				tr.append('td')
					.text(v)
					.style('padding', '8px')
		}
	}

	self.mayshow_coefficients = result => {
		if (!result.coefficients) return
		const div = self.newDiv(result.coefficients.label)
		const table = div.append('table').style('border-spacing', '0px')

		// padding is set on every <td>. need a better solution

		// header row
		{
			const tr = table.append('tr').style('opacity', 0.4)
			for (const v of result.coefficients.header) {
				tr.append('td')
					.text(v)
					.style('padding', '8px')
			}
		}
		// intercept row
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
		// independent terms, individually
		let rowcount = 0
		for (const tid in result.coefficients.terms) {
			const termdata = result.coefficients.terms[tid]
			const term = self.state.config.independent.find(t => t.id == tid)
			let tr = table.append('tr').style('background', rowcount++ % 2 ? '#eee' : 'none')

			// term name
			const termNameTd = tr.append('td').style('padding', '8px')
			fillTdName(termNameTd, term ? term.term.name : tid)
			if ('refGrp' in term && term.refGrp != refGrp_NA) {
				termNameTd
					.append('div')
					.style('font-size', '.8em')
					.style('opacity', 0.6)
					.text(
						'REF: ' +
							(term.term.values && term.term.values[term.refGrp] ? term.term.values[term.refGrp].label : term.refGrp)
					)
			}

			if (termdata.fields) {
				// no category
				tr.append('td')
				for (const v of termdata.fields) {
					tr.append('td')
						.text(v)
						.style('padding', '8px')
				}
			} else if (termdata.categories) {
				const orderedCategories = []
				const input = self.parent.inputs.independent.inputs.find(i => i.term.id == tid)
				if (input.orderedLabels) {
					// reorder rows by predefined order
					for (const k of input.orderedLabels) {
						if (termdata.categories[k]) orderedCategories.push(k)
					}
				}
				for (const k in termdata.categories) {
					if (!orderedCategories.includes(k)) orderedCategories.push(k)
				}

				// multiple categories
				// show first category as full row, with first cell spanning rest of categories
				termNameTd.attr('rowspan', orderedCategories.length).style('vertical-align', 'top')

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
		// interactions
		for (const row of result.coefficients.interactions) {
			const tr = table.append('tr').style('background', rowcount++ % 2 ? '#eee' : 'none')

			const term1 = self.state.config.independent.find(t => t.id == row.term1)
			const term2 = self.state.config.independent.find(t => t.id == row.term2)

			// variable column
			{
				const td = tr.append('td').style('padding', '8px')
				fillTdName(td.append('div'), term1 ? term1.term.name : row.term1)
				fillTdName(td.append('div'), term2 ? term2.term.name : row.term2)
			}
			// category column
			{
				const td = tr.append('td').style('padding', '8px')
				const d1 = td.append('div')
				if (row.category1) {
					d1.text(
						term1 && term1.term.values && term1.term.values[row.category1]
							? term1.term.values[row.category1].label
							: row.category1
					)
				}
				const d2 = td.append('div')
				if (row.category2) {
					d2.text(
						term2 && term2.term.values && term2.term.values[row.category2]
							? term2.term.values[row.category2].label
							: row.category2
					)
				}
			}
			for (const v of row.lst) {
				tr.append('td')
					.text(v)
					.style('padding', '8px')
			}
		}
	}

	self.mayshow_other = result => {
		if (!result.other) return
		const div = self.newDiv(result.other.label)
		const table = div.append('table').style('border-spacing', '8px')
		for (const [k, v] of result.other.lst) {
			const tr = table.append('tr')
			tr.append('td')
				.style('opacity', 0.4)
				.text(k)
			tr.append('td').text(v)
		}
	}
}

function fillTdName(td, name) {
	if (name.length < 30) {
		td.text(name)
	} else {
		td.text(name.substring(0, 25) + ' ...').attr('title', name)
	}
}
