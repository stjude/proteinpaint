import * as rx from '../common/rx.core'
import { select, event } from 'd3-selection'
import { dofetch2, Menu } from '../client'
import * as dom from '../dom'
// import { TVSInit } from './tvs'
import { TvsLstInit } from '../common/tvslst'
import { appInit } from './app'
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
		setRenderers(this)
		this.categoryData = {}
		this.initHolder()
		this.api = rx.getComponentApi(this)
		this.eventTypes = ['postInit', 'postRender']
	}
	validateOpts(o) {
		// if (!('id' in o)) throw 'opts.id missing' // plot id?
		if (!o.holder) throw 'opts.holder missing'
		this.opts = o
		this.dom = { holder: o.holder, tip: new Menu({ padding: '5px' }) }
		this.durations = { exit: 500 }
	}
	getState(appState) {
		return appState
	}
	main() {
		if (!this.filter) this.initFilter()
		this.render()
	}
	initFilter() {
		this.inclusions = TvsLstInit({
			adderLabel: '+Include',
			genome: this.state.genome,
			dslabel: this.state.dslabel,
			holder: this.dom.inclusionsDiv,
			getData: () =>
				this.state.termfilter.inclusions ? this.state.termfilter.inclusions : this.state.termfilter.terms,
			callback: {
				addGrp: term => {
					this.app.dispatch({
						type: 'filter_add_grp',
						term,
						filterKey: this.state.termfilter.inclusions ? 'inclusions' : 'terms'
					})
				},
				addTerm: (term, index) => {
					this.app.dispatch({ type: 'filter_add_term', term, index, filterKey: 'inclusions' })
				}
			}
		})

		if (!this.state.termfilter.exclusions || this.state.termfilter.terms) return
		this.exclusions = TvsLstInit({
			adderLabel: '+Exclude',
			genome: this.state.genome,
			dslabel: this.state.dslabel,
			holder: this.dom.exclusionsDiv,
			callback: {
				addGrp: term => {
					this.app.dispatch({
						type: 'filter_add_grp',
						term,
						filterKey: 'exclusions'
					})
				},
				addTerm: (term, index) => {
					this.app.dispatch({ type: 'filter_add_term', term, index, filterKey: 'exclusions' })
				}
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

		// div to display filter terms
		this.dom.inclusionsDiv = div
			.append('div')
			.attr('class', 'terms_div')
			.style('display', 'inline-block')

		this.dom.exclusionsDiv = div
			.append('div')
			.attr('class', 'terms_div')
			.style('display', 'inline-block')
	}
	self.render = function() {
		const state = self.state
		const div = this.dom.holder
		if (state && state.termfilter && !state.termfilter.show_top_ui) {
			div.style('display', 'none')
			return
		}
		self.inclusions.main(
			this.state.termfilter.inclusions ? this.state.termfilter.inclusions : this.state.termfilter.terms
		)
		if (self.exclusions) self.exclusions.main(this.state.termfilter.exclusions)
		div.style('display', 'inline-block')
	}
}
