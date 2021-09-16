import * as rx from '../common/rx.core'
import { select } from 'd3-selection'

class ToyTable {
	constructor(opts) {
		this.type = 'table'
		// set this.id, .app, .opts, .api
		rx.prepComponent(this, opts)
		this.dom = {
			holder: opts.holder,
			table: opts.holder.append('table')
		}
		setInteractivity(this)
		setRenderers(this)
	}

	getState(appState) {
		return appState
	}

	main() {
		this.render()
	}
}

function setRenderers(self) {
	self.render = function() {
		const divs = self.dom.table.selectAll('.table-wrapper').data(self.state.terms, term => term.id)

		divs.exit().each(self.exitDiv)
		divs.each(self.updateDiv)
		divs
			.enter()
			.append('div')
			.attr('class', 'table-wrapper')
			.each(self.addDiv)
	}

	self.exitDiv = function(term) {
		select(this) // div
			.style('opacity', 1)
			.transition()
			.duration(500)
			.style('opacity', 0)
			.remove()
	}

	self.updateDiv = function(term) {
		// re-sort rows, etc
		const keyVals = Object.keys(term).map(key => [key, term[key]])
		const tr = select(this) // div
			.selectAll('table')
			.selectAll('tr')
			.data(keyVals, self.trBindKey)

		tr.exit().remove()
		tr.each(self.updateTr)
		tr.enter()
			.append('tr')
			.each(self.addTr)
	}

	self.addDiv = function(term) {
		const div = select(this)
		div
			.style('position', 'relative')
			.style('margin', '10px')
			.style('padding', '10px 3px')
			.style('background-color', '#ececec')
			.style('opacity', 0)
			.transition()
			.duration(500)
			.style('opacity', 1)

		div
			.append('button')
			.datum(term)
			.html('remove')
			.style('margin', '5px')
			.on('click', self.removeDiv)

		const table = div.append('table')
		const keyVals = Object.keys(term).map(key => [key, term[key]])
		const tr = table.selectAll('tr').data(keyVals, d => d[0])

		tr.exit().remove()
		tr.each(self.updateTr)
		tr.enter()
			.append('tr')
			.each(self.addTr)
	}

	self.addTr = function(keyVal, index) {
		const tr = select(this)
		tr.style('background-color', index % 2 == 0 ? '#fff' : '')
		tr.append('td')
			.html(keyVal[0])
			.style('padding', '3px 5px')
		tr.append('td')
			.html(keyVal[1])
			.style('padding', '3px 5px')
		self.hideShowRaw(tr, keyVal[0])
	}

	self.updateTr = function(keyVal, index) {
		const tr = select(this)
		// if there are computed labels, can update via .html(label)
		self.hideShowRaw(tr, keyVal[0])
	}

	self.hideShowRaw = (tr, row_name) => {
		const rows = self.state.controls.rows.map(r => r.name)
		if (rows.includes(row_name)) {
			const row = self.state.controls.rows.find(r => r.name == row_name)
			if (row.hide) {
				tr.style('visibility', 'collapse')
					.style('opacity', 0)
					.style('transition', 'visibility .5s ease, opacity .5s ease')
			} else {
				tr.style('visibility', 'visible')
					.style('opacity', 1)
					.style('transition', 'visibility .5s ease, opacity .5s ease')
			}
		}
	}
}

function setInteractivity(self) {
	self.removeDiv = term => self.app.dispatch({ type: 'term_rm', termid: term.id })
}

export const tableInit = rx.getInitFxn(ToyTable)
