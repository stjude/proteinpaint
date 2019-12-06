import * as rx from '../common/rx.core'
import { select, event } from 'd3-selection'
import { dofetch2, Menu } from '../client'
import * as dom from '../dom'
// import { TVSInit } from './tvs'
import { TVSInit } from '../common/tvs'
import { appInit } from './app'
import * as client from '../client'
/*
for configuring filter; just a thin wrapper of blue pill UI
execution flow:
1. constructor builds and returns this.api{}
2. no state available for constructor so cannot do term-type specific things
3. upon getting state from app.js, call api.main() with latest state
4. then call this.initPill() to initiate bluepill
*/
class TdbFilter {
	constructor(opts) {
		this.type = 'filter'
		this.validateOpts(opts)
		setRenderers(this)
		this.categoryData = {}
		this.initHolder()
		this.api = rx.getComponentApi(this)
		this.eventTypes = ['postInit', 'postRender']
	}
	validateOpts(o) {
		// if (!('id' in o)) throw 'opts.id missing' // plot id?
		if (!o.holder) throw 'opts.holder missing'
		if (typeof o.dispatch != 'function') throw 'opts.dispath() is not a function'
		this.opts = o
		this.dom = { holder: o.holder, tip: new Menu({ padding: '5px' }) }
		this.durations = { exit: 500 }
	}
	getState(appState) {
		return appState
	}
	main() {
		if (!this.pill) this.initPill()
		this.render()
	}
	initPill() {
		this.pill = TVSInit({
			genome: this.state.genome,
			dslabel: this.state.dslabel,
			holder: this.dom.pilldiv,
			debug: this.opts.debug,
			callback: tvslst => {
				this.opts.dispatch({
					type: 'filter_add',
					tvslst
				})
			}
		})
	}
}
exports.filterInit = rx.getInitFxn(TdbFilter)
function setRenderers(self) {
	self.initHolder = function() {
		const div = this.dom.holder
			.attr('class', 'filter_div')
			.style('width', 'fit-content')
			.style('padding', '5px')
			.style('margin', '10px')
			.style('margin-top', '5px')
			.style('display', 'block')
			.style('border', 'solid 1px #ddd')
		div
			.append('div')
			.style('display', 'inline-block')
			.style('text-transform', 'uppercase')
			.style('color', '#bbb')
			.style('margin-right', '10px')
			.html('Filter')
		// div to display all tvs bluepills
		this.dom.pilldiv = div
			.append('div')
			.attr('class', 'terms_div')
			.style('display', 'inline-block')
	}
	self.render = function() {
		const state = self.state
		const div = this.dom.pilldiv
		if (state && state.termfilter && !state.termfilter.show_top_ui) {
			div.style('display', 'none')
			return
		}
		self.pill.main({
			termfilter: state.termfilter
		})
		div.style('display', 'inline-block')
	}
}