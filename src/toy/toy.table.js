import {Component, getInitFxn} from "../rx.core"
import {select} from "d3-selection"

class ToyTable extends Component {
	constructor(app, holder) {
		super()
		this.app = app
		this.opts = holder
		this.dom = {
			holder,
			table: holder.append('table')
		}
		this.yesThis()
		this.notThis(this)
	}

	// as a convenience, 
	// instance.reactsTo() will be called before
	// instance.main() in Component api.main()
	// acty = action.type.split("_")
	reactsTo(action, acty) {
		if (acty[0] == "term") return true
	}

	main(action) {
		const divs = this.dom.table.selectAll('.table-wrapper')
			.data(this.app.state().terms, this.getTermId)

		divs.exit().remove()
		divs.each(this._updateDiv)
		divs.enter()
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

		div.append('button')
			.datum(term)
			.html('remove')
			.style('margin', '5px')
			.on('click', this.removeDiv)

		const table = div.append('table')
		const keyVals = Object.keys(term).map(key => [key, term[key]])
		const tr = table.selectAll('tr')
			.data(keyVals, this.trBindKey)

		tr.exit().remove()
		tr.each(this._updateDiv)
		tr.enter().append('tr').each(this._addTr)
	}

	updateDiv(term, div) {
		// don't do anything for now
		// re-sort rows, etc
	}

	addTr(keyVal, tr, index) {
		tr.style('background-color', index%2 == 0 ? '#fff' : '')
		tr.append('td').html(keyVal[0]).style('padding', '3px 5px')
		tr.append('td').html(keyVal[1]).style('padding', '3px 5px')
	}

	getTermId(term) {
		return term.id
	}

	trBindKey(d) {
		return d[0]
	}

	yesThis() {
		this.removeDiv = term => this.app.dispatch({type: 'term_rm', termid: term.id})
	}

	notThis(self) {
		self._addDiv = function(term) {
			self.addDiv(term, select(this))
		}
		self._updateDiv = function(term) {
			self.updateDiv(term, select(this))
		}
		self._addTr = function(keyVal, index) {
			self.addTr(keyVal, select(this), index)
		}
	}
}

export const tableInit = getInitFxn(ToyTable)
