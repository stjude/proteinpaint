import * as rx from '../rx/core'
import { select } from 'd3-selection'

class TdbTable {
	constructor(app, opts) {
		this.type = 'plot.table'
		this.id = opts.id
		this.app = app
		this.opts = opts
		this.api = rx.getComponentApi(this)
		this.dom = {
			div: this.opts.holder.style('margin', '10px 0px').style('display', 'none')
		}
		setRenderers(this)
		this.eventTypes = ['postInit', 'postRender']
	}

	main(data) {
		if (data) this.data = data
		this.config = this.state.config
		if (!this.state.isVisible) {
			this.dom.div.style('display', 'none')
			return
		}
		if (!this.config.term2) {
			this.dom.div.style('display', 'none')
			throw 'term2 is required for table view'
		}
		const [column_keys, rows] = this.processData(this.data)
		this.render(column_keys, rows)
	}

	processData(data) {
		const column_keys = data.refs.rows
		const t1 = this.config.term.term
		const rows = data.refs.cols.map(v1 => {
			const series = data.charts[0].serieses.find(d => d.seriesId == v1)
			const label = t1.values && v1 in t1.values ? t1.values[v1].label : v1
			return {
				label,
				lst: !series
					? []
					: series.data
							.slice()
							.sort((a, b) => column_keys.indexOf(a.dataId) - column_keys.indexOf(b.dataId))
							.map(d => {
								return {
									label: d.dataId,
									value: d.total
								}
							})
			}
		})
		return [column_keys, rows]
	}

	download() {
		if (!this.state.isVisible) return
		const data = []
		this.dom.div.selectAll('tr').each(function() {
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
				a.download = this.config.term.term.name + ' table.txt'
				a.href = URL.createObjectURL(new Blob([matrix], { type: 'text/tab-separated-values' }))
				document.body.removeChild(a)
			},
			false
		)
		a.click()
	}
}

function setRenderers(self) {
	self.render = function render(column_keys, rows) {
		self.dom.div
			.style('display', 'inline-block')
			.selectAll('*')
			.remove()

		// show table
		const table = self.dom.div
			.append('table')
			//.style('margin-left','20px')
			.style('margin-right', '20px')
			.style('border-spacing', '3px')
			.style('border-collapse', 'collapse')
			.style('border', '1px solid black')

		// header
		const tr = table
			.append('tr')
			.style('white-space', 'normal')
			.style('background-color', '#ececec')

		tr.append('td') // column 1
		// print term2 values as rest of columns
		for (const i of column_keys) {
			tr.append('th')
				.text(i.length > 20 ? i.slice(0, 16) + '...' : i)
				.attr('title', i)
				.style('border', '1px solid black')
				.style('padding', '3px')
				.style('text-align', 'center')
				.style('min-width', '80px')
				.style('max-width', '150px')
				.style('word-break', i.length > 12 ? 'break-word' : 'normal')
				.style('vertical-align', 'top')
		}

		let i = 0
		for (const t1v of rows) {
			const tr = table.append('tr').style('background-color', i++ % 2 == 0 ? '#fff' : '#ececec')

			// column 1
			tr.append('th')
				.text(t1v.label.length > 20 ? t1v.label.slice(0, 20) + '...' : t1v.label)
				.attr('title', t1v.label)
				.style('border', '1px solid black')
				.style('padding', '3px')
				.style('word-break', t1v.label.length > 12 ? 'break-all' : 'normal')

			// other columns
			for (const t2label of column_keys) {
				const td = tr
					.append('td')
					.style('border', '1px solid black')
					.style('padding', '3px 5px')
					.style('text-align', 'center') //'right')
				const v = t1v.lst.find(i => i.label == t2label)
				if (v) {
					td //.append('div')
						//.style('display', 'inline-block')
						//.style('text-align', 'right')
						//.style('min-width', '50px')
						.html(v.value)
				}
			}
		}
	}
}

export const tableInit = rx.getInitFxn(TdbTable)
