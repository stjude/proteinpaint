import { getCompInit } from '../common/rx.core'
import { select } from 'd3-selection'

class ToyFilter {
	constructor(opts) {
		this.type = 'filter'
		setInteractivity(this)
		setRenderers(this)
	}

	async init() {
		try {
			this.dom = { holder: this.opts.holder }
			this.initUI()
		} catch (e) {
			throw e
		}
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
		// most components will process data here,
		// but this component does not need to that
		this.render()
	}
}

export const filterInit = getCompInit(ToyFilter)

function setRenderers(self) {
	self.initUI = function() {
		const div = self.dom.holder
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

		const all_btn_div = self.dom.holder
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
			.on('click', self.showHideAll)

		label
			.append('span')
			.style('margin', '5px')
			.text('ALL')
	}

	self.render = () => {
		const rows = self.dom.holder.selectAll('.row_div').data(self.state.rows, self.getRowName)

		rows.exit().each(self.removeRow)
		rows.each(self.updateRow)
		rows
			.enter()
			.append('div')
			.attr('class', 'row_div')
			.each(self.addRow)

		self.updateAllBtn()
	}

	self.addRow = function(row) {
		const div = select(this)
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
			.on('click', self.hideRow)

		label
			.append('span')
			.datum(row)
			.style('margin', '5px')
			.text(row.name)
	}

	self.updateRow = function(row) {
		const div = select(this)
		const label = div.select('label').datum(row)

		label
			.select('input')
			.property('checked', row.hide ? false : true)
			.on('click', self.hideRow)

		label.select('span').text(row.name)
	}

	self.removeRow = function(row) {
		const div = select(this)
		div.select('label').datum(row)
		div
			.style('opacity', 1)
			.transition()
			.duration(500)
			.style('opacity', 0)
			.remove()
	}

	self.getRowName = row => row.name

	self.updateAllBtn = () => {
		const all_btn = self.dom.holder.selectAll('.all_btn')
		const hiddencount = self.state.rows.map(a => a.hide)
		all_btn.property('checked', hiddencount.includes(true) ? false : true)
	}
}

function setInteractivity(self) {
	self.showHideAll = () => {
		const all_btn = self.dom.holder.selectAll('.all_btn')
		if (all_btn.property('checked')) {
			self.state.rows.forEach(row => {
				if (row.hide) self.app.dispatch({ type: 'term_row_hide', row_name: row.name })
			})
		} else {
			self.state.rows.forEach(row => {
				if (!row.hide) self.app.dispatch({ type: 'term_row_hide', row_name: row.name })
			})
		}
	}

	self.hideRow = row => self.app.dispatch({ type: 'term_row_hide', row_name: row.name })
}
