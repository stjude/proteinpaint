import * as rx from "../rx.core"
import {select, event} from "d3-selection"
import {dofetch2} from "../client"
import {plotInit} from "./plot"

class TdbFilter {
	constructor(app, opts) {
		this.api = rx.getComponentApi(this)
		this.app = app
		this.dom = {holder: opts.holder}
		// set closure methods to handle conflicting "this" contexts
		// this.yesThis()
        // this.notThis(this)
        this.render()

		// this.components = {
		// 	plots: {}
		// }

		this.bus = new rx.Bus('filter', ['postInit', 'postNotify'], app.opts.callbacks, this.api)
		this.bus.emit('postInit')
	}

	reactsTo(action, acty) {
		if (acty[0] == 'filter') return true
	}

	main(action) {
		const filters = this.dom.holder.selectAll('.filter_div')
			.data(this.app.state().termfilter.terms)

		// rows.exit().each(this._removeRow)
		// rows.each(this._updateRow)
		// rows.enter()
		// 	.append('div')
		// 	.attr('class', 'row_div')
		// 	.each(this._addRow)

		// this.updateAllBtn()
	}
	
	render() {
		const div = this.dom.holder
			.attr('class','filter_div')
			.style('width', 'fit-content')
			.style('padding', '5px')
			.style('margin', '10px')
			.style('margin-top', '5px')
			.style("display", "block")
			.style('font-size','.9em')
			.style("border", "solid 1px #ddd")

		div.append("div")
			.style("display", "inline-block")
			.style('text-transform', 'uppercase')
			.style('color','#bbb')
			.style('margin-right','10px')
			.html('Filters')
	}
}

exports.filterInit = rx.getInitFxn(TdbFilter)
