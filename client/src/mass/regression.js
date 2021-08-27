import * as rx from '../common/rx.core'
import { select } from 'd3-selection'

class MassRegression {
	constructor(app, opts) {
		this.type = 'regression'
		this.id = opts.id
		this.app = app
		this.opts = opts
		this.api = rx.getComponentApi(this)
		this.dom = {
			div: this.opts.holder.style('margin', '10px 0px').style('display', 'none')
		}
		setInteractivity(this)
		setRenderers(this)
		this.eventTypes = ['postInit', 'postRender']
		//opts.controls.on('downloadClick.regression', this.download)
	}

	getState(appState, sub) {
		if (!(this.id in appState.tree.plots)) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		const config = appState.tree.plots[this.id]
		return {
			isVisible: config?.settings?.currViews.includes('regression'),
			activeCohort: appState.activeCohort,
			termfilter: appState.termfilter,
			config: {
				cutoff: config.cutoff,
				term: config.term,
				independent: config.independent,
				settings: {
					table: config?.settings?.regression
				}
			}
		}
	}

	main(data) {
		if (data) this.data = data
		if (!this.state.isVisible) {
			this.dom.div.style('display', 'none')
			return
		}
		if (!data || !this.state.config.term) return
		this.config = this.state.config
		if (!this.config.independent) {
			this.dom.div.style('display', 'none')
			throw 'independent variable(s) is required for regression analysis'
		}
		this.dom.div
			.style('display', 'inline-block')
			.selectAll('*')
			.remove()
		const tables = this.processData(this.data)
		for (const name in tables) {
			const [columns, rows] = tables[name]
			this.renderTable(this.dom.div, name, columns, rows)
		}
	}

	processData(multipleData) {
		const tables = {}
		for (const data of multipleData) {
			let columns, rows
			if (data.format === 'matrix') {
				columns = data.keys.map(key => {
					return { key, label: key }
				})
				rows = data.rows.map((row, i) => {
					let config
					return {
						lst: row.map((r, i) => {
							let value = r
							if (columns[i].label === 'Variable') {
								config = this.state.config.independent.find(x => x.id === r)
								if (config) value = config.term.name // get term name to display in table
							}
							if (columns[i].label === 'Category') {
								if (config) {
									if (config.term.values) {
										value = r in config.term.values ? config.term.values[r].label : r
									}
								}
							}
							return { label: columns[i].label, value: value }
						})
					}
				})
			} else if (data.format === 'vector') {
				columns = undefined
				rows = data.rows
			} else {
				throw `data format '${data.format}' is not recognized`
			}
			tables[data.name] = [columns, rows]
		}
		return tables
	}
}

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
	self.renderTable = function(div, name, columns, rows) {
		// show table title
		const title_div = div
			.append('div')
			.style('text-decoration', 'underline')
			.style('padding-top', '10px')
			.style('padding-bottom', '15px')
			.html(name + ':')
		// show table
		const table = div
			.append('table')
			//.style('margin-left','20px')
			//.style('margin-right', '20px')
			//.style('margin-top', '10px')
			.style('margin-bottom', '20px')
			.style('border-spacing', '3px')
			.style('border-collapse', 'collapse')
			.style('border', '1px solid #999')

		// header
		const tr = table
			.append('tr')
			.style('white-space', 'normal')
			.style('background-color', '#ececec')

		// print term2 values as rest of columns
		if (columns) {
			for (const value of columns) {
				const label = value.label
				tr.append('th')
					.text(label.length > 20 ? label.slice(0, 16) + '...' : label)
					.attr('title', label)
					// .style('border', '1px solid black')
					.style('padding', '3px 5px')
					.style('text-align', 'center')
					.style('min-width', '80px')
					.style('max-width', '150px')
					.style('word-break', label.length > 12 ? 'break-word' : 'normal')
					.style('vertical-align', 'top')
					.style('font-weight', 'normal')
					.style('color', '#777')
			}

			let i = 0
			for (const t1v of rows) {
				const tr = table.append('tr').style('background-color', i++ % 2 == 0 ? '#fff' : '#ececec')

				const column_keys = columns.map(d => d.key)
				for (const t2label of column_keys) {
					const td = tr
						.append('td')
						// .style('border', '1px solid black')
						.style('padding', '3px 15px')
					const v = t1v.lst.find(i => i.label == t2label)
					if (v) {
						td //.append('div')
							//.style('display', 'inline-block')
							//.style('text-align', 'right')
							//.style('min-width', '50px')
							.style('text-align', Number.isNaN(Number(v.value)) ? 'left' : 'right')
							.html(v.value)
					}
				}
			}
		} else {
			let i = 0
			for (const row of rows) {
				const tr = table
					.append('tr')
					.style('background-color', i++ % 2 == 0 ? '#fff' : '#ececec')
					// .style('border', '1px solid black')
					.style('padding', '3px 5px')
					.style('text-align', 'center') //'right')
				for (const [i, cell] of row.entries()) {
					tr.append('td')
						// .style('border', '1px solid black')
						.style('padding', '3px 15px')
						// .style('text-align', 'center')
						.style('text-align', Number.isNaN(Number(cell)) ? 'left' : 'right')
						.style('color', i == 0 ? '#777' : '#000')
						.html(cell)
				}
			}
		}
	}
}

export const regressionInit = rx.getInitFxn(MassRegression)
