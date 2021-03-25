import * as rx from '../common/rx.core'
import { select } from 'd3-selection'

class ToyFilter {
	constructor(app, opts) {
		this.type = 'filter'
		this.api = rx.getComponentApi(this)
		this.app = app
		this.dom = { holder: opts.holder }

		// set closured methods to use the correct "this" context
		this.yesThis()
		this.notThis(this)
		this.render()
	}

	reactsTo(action) {
		return action.type.startsWith('term')
	}

	getState(appState) {
		return {
			rows: appState.controls.rows
		}
	}

	main() {
		const rows = this.dom.holder.selectAll('.row_div').data(this.state.rows, this.getRowName)

		rows.exit().each(this._removeRow)
		rows.each(this._updateRow)
		rows
			.enter()
			.append('div')
			.attr('class', 'row_div')
			.each(this._addRow)

		this.updateAllBtn()
	}

	render() {
		const div = this.dom.holder
			.attr('class', 'filter_div')
			.style('width', 'fit-content')
			.style('padding', '5px')
			.style('margin-top', '5px')
			.style('display', 'block')
			.style('font-size', '.9em')
			.style('border', 'solid 1px #ddd')

		div
			.append('div')
			.style('display', 'inline-block')
			.style('text-transform', 'uppercase')
			.style('color', '#bbb')
			.style('margin-right', '10px')
			.html('Rows')

		const all_btn_div = this.dom.holder
			.append('div')
			.style('display', 'inline-block')
			.style('position', 'relative')
			.style('margin', '5px')
			.style('padding', '3px')

		const label = all_btn_div.append('label').attr('class', 'checkbox-inline')

		label
			.append('input')
			.attr('class', 'all_btn')
			.attr('type', 'checkbox')
			.attr('value', 'all')
			.on('click', this.showHideAll)

		label
			.append('span')
			.style('margin', '5px')
			.text('ALL')
	}

	addRow(row, div) {
		div
			.style('display', 'inline-block')
			.style('position', 'relative')
			.style('margin', '5px')
			.style('padding', '3px')
			.style('opacity', 0)
			.transition()
			.duration(500)
			.style('opacity', 1)

		const label = div.append('label').attr('class', 'checkbox-inline')

		label
			.append('input')
			.attr('type', 'checkbox')
			.datum(row)
			.attr('value', row.name)
			.property('checked', row.hide ? false : true)
			.on('click', this.hideRow)

		label
			.append('span')
			.datum(row)
			.style('margin', '5px')
			.text(row.name)
	}

	updateRow(row, div) {
		const label = div.select('label').datum(row)

		label
			.select('input')
			.property('checked', row.hide ? false : true)
			.on('click', this.hideRow)

		label.select('span').text(row.name)
	}

	removeRow(row, div) {
		div.select('label').datum(row)

		div
			.style('opacity', 1)
			.transition()
			.duration(500)
			.style('opacity', 0)
			.remove()
	}

	getRowName(row) {
		return row.name
	}

	yesThis() {
		this.hideRow = row => this.app.dispatch({ type: 'term_row_hide', row_name: row.name })

		this.showHideAll = () => {
			const all_btn = this.dom.holder.selectAll('.all_btn')
			if (all_btn.property('checked')) {
				this.state.rows.forEach(row => {
					if (row.hide) this.app.dispatch({ type: 'term_row_hide', row_name: row.name })
				})
			} else {
				this.state.rows.forEach(row => {
					if (!row.hide) this.app.dispatch({ type: 'term_row_hide', row_name: row.name })
				})
			}
		}

		this.updateAllBtn = () => {
			const all_btn = this.dom.holder.selectAll('.all_btn')
			const hiddencount = this.state.rows.map(a => a.hide)
			all_btn.property('checked', hiddencount.includes(true) ? false : true)
		}
	}

	notThis(self) {
		self._addRow = function(row) {
			self.addRow(row, select(this))
		}
		self._updateRow = function(row) {
			self.updateRow(row, select(this))
		}
		self._removeRow = function(row) {
			self.removeRow(row, select(this))
		}
	}
}

export const filterInit = rx.getInitFxn(ToyFilter)
