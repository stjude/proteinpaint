import * as rx from '../common/rx.core'
import { select, event } from 'd3-selection'
import { Menu } from '../client'
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
		const f = this.state && this.state.termfilter
		if (!f || this.state.nav.header_mode !== 'with_tabs') {
			this.dom.holder.style('display', 'none')
			return
		}
		this.dom.holder.style('display', 'inline-block')
		if (!this.filterApi) this.initFilter()
		this.filterApi.main(f.filter, { activeCohort: this.state.activeCohort })
	}

	initFilter() {
		// only call in main(), requires this.state{}
		this.filterApi = filterInit({
			vocab: this.state.vocab,
			nav: this.state.nav,
			holder: this.dom.filterDiv,
			debug: this.app.opts.debug,
			newBtn: this.opts.newBtn,
			emptyLabel: this.opts.emptyLabel,
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
			.style('border', this.opts.hideLabel ? 'none' : 'solid 1px #ddd')

		if (this.opts.hideLabel) {
			this.dom.filterDiv = div.style('display', 'inline-block').style('padding', '5px 10px')
		} else {
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
}

export const filter3Init = rx.getInitFxn(TdbFilter)
