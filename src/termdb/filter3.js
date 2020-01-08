import * as rx from '../common/rx.core'
import { select, event } from 'd3-selection'
import { dofetch2, Menu } from '../client'
import * as dom from '../dom'
import { filterInit } from '../common/filter'
import * as client from '../client'
/*
for configuring filter; just a thin wrapper of blue filter UI
execution flow:
1. constructor builds and returns this.api{}
2. no state available for constructor so cannot do term-type specific things
3. upon getting state from app.js, call api.main() with latest state
4. then call this.initFilter() to initiate filter
*/
class TdbFilter {
	constructor(app, opts) {
		this.type = 'filter'
		this.app = app
		this.validateOpts(opts)
		this.initHolder()
		this.api = rx.getComponentApi(this)
		this.eventTypes = ['postInit', 'postRender']
	}

	validateOpts(o) {
		if (!o.holder) throw 'opts.holder missing'
		this.opts = o
		this.dom = { holder: o.holder }
	}

	getState(appState) {
		return appState
	}

	main() {
		const termfilter = this.state && this.state.termfilter
		if (termfilter && !termfilter.show_top_ui) {
			this.dom.holder.style('display', 'none')
			return
		}
		this.dom.holder.style('display', 'inline-block')
		if (!this.filterApi) this.initFilter()
		this.filterApi.main(termfilter.filter)
	}

	initFilter() {
		this.filterApi = filterInit({
			genome: this.state.genome,
			dslabel: this.state.dslabel,
			holder: this.dom.filterDiv,
			debug: this.app.opts.debug,
			callback: filter => {
				this.app.dispatch({
					type: 'filter_replace',
					filter
				})
			}
		})
	}

	initHolder() {
		const div = this.dom.holder
			.attr('class', 'filter_div')
			.style('position', 'relative')
			.style('width', 'fit-content')
			.style('margin', '10px')
			.style('margin-top', '5px')
			.style('display', 'table')
			.style('border', 'solid 1px #ddd')

		div
			.append('span')
			.text('Filter')
			.style('padding', '0 10px')

		this.dom.filterDiv = div
			.append('div')
			.style('display', 'inline-block')
			.style('padding', '5px 10px')
	}
}

exports.filterInit = rx.getInitFxn(TdbFilter)
