import * as rx from '../common/rx.core'
import { select } from 'd3-selection'

class ToyTable {
	constructor(opts) {
		this.type = 'table'
		this.app = opts.app
		this.opts = rx.getOpts(opts, this)
		this.api = rx.getComponentApi(this)
		this.dom = {
			holder: opts.holder,
			table: opts.holder.append('table')
		}
		this.yesThis()
		this.notThis(this)
	}

	getState(appState) {
		return appState
	}

	main() {
		const divs = this.dom.table.selectAll('.table-wrapper').data(this.state.terms, this.getTermId)

		divs.exit().each(this._exitDiv)
		divs.each(this._updateDiv)
		divs
			.enter()
			.append('div')
			.attr('class', 'table-wrapper')
			.each(this._addDiv)
	}

	addDiv(term, div) {
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
			.on('click', this.removeDiv)

		const table = div.append('table')
		const keyVals = Object.keys(term).map(key => [key, term[key]])
		const tr = table.selectAll('tr').data(keyVals, this.trBindKey)

		tr.exit().remove()
		tr.each(this._updateTr)
		tr.enter()
			.append('tr')
			.each(this._addTr)
	}

	updateDiv(term, div) {
		// re-sort rows, etc
		const keyVals = Object.keys(term).map(key => [key, term[key]])
		const tr = div
			.selectAll('table')
			.selectAll('tr')
			.data(keyVals, this.trBindKey)

		tr.exit().remove()
		tr.each(this._updateTr)
		tr.enter()
			.append('tr')
			.each(this._addTr)
	}

	exitDiv(term, div) {
		div
			.style('opacity', 1)
			.transition()
			.duration(500)
			.style('opacity', 0)
			.remove()
	}

	addTr(keyVal, tr, index) {
		tr.style('background-color', index % 2 == 0 ? '#fff' : '')
		tr.append('td')
			.html(keyVal[0])
			.style('padding', '3px 5px')
		tr.append('td')
			.html(keyVal[1])
			.style('padding', '3px 5px')
		this.hideShowRaw(tr, keyVal[0])
	}

	updateTr(keyVal, tr, index) {
		// if there are computed labels, can update via .html(label)
		this.hideShowRaw(tr, keyVal[0])
	}

	getTermId(term) {
		return term.id
	}

	trBindKey(d) {
		return d[0]
	}

	hideShowRaw(tr, row_name) {
		const rows = this.state.controls.rows.map(r => r.name)
		if (rows.includes(row_name)) {
			const row = this.state.controls.rows.find(r => r.name == row_name)
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

	yesThis() {
		this.removeDiv = term => this.app.dispatch({ type: 'term_rm', termid: term.id })
	}

	notThis(self) {
		self._addDiv = function(term) {
			self.addDiv(term, select(this))
		}
		self._updateDiv = function(term) {
			self.updateDiv(term, select(this))
		}
		self._exitDiv = function(term) {
			self.exitDiv(term, select(this))
		}
		self._addTr = function(keyVal, index) {
			self.addTr(keyVal, select(this), index)
		}
		self._updateTr = function(keyVal, index) {
			self.updateTr(keyVal, select(this), index)
		}
	}
}

export const tableInit = rx.getInitFxn(ToyTable)
