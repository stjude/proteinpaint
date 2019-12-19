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
		if (!this.inclusions) this.initFilter()
		this.render()
	}

	initFilter() {
		this.inclusions = TvsLstInit({
			adderLabel: '+Include',
			genome: this.state.genome,
			dslabel: this.state.dslabel,
			holder: this.dom.inclusionsDiv,
			debug: this.app.opts.debug,
			getData: () =>
				this.state.termfilter.inclusions ? this.state.termfilter.inclusions : this.state.termfilter.terms,
			callback: tvslst => {
				this.app.dispatch({
					type: 'filter_replace',
					filterKey: this.state.termfilter.inclusions ? 'inclusions' : 'terms',
					tvslst
				})
			}
		})

		if (!this.state.termfilter.exclusions) return
		this.exclusions = TvsLstInit({
			adderLabel: '+Exclude',
			genome: this.state.genome,
			dslabel: this.state.dslabel,
			holder: this.dom.exclusionsDiv,
			debug: this.app.opts.debug,
			callback: tvslst => {
				this.app.dispatch({
					type: 'filter_replace',
					filterKey: 'exclusions',
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

		this.setFilterBtn(div, 'Inclusions', 'inclusions')
		this.dom.inclusionsBtn.on('click', () => this.dom.inclusionsTip.showunder(this.dom.inclusionsBtn.node()))

		this.setFilterBtn(div, 'Exclusions', 'exclusions')
		this.dom.exclusionsBtn.on('click', () => this.dom.exclusionsTip.showunder(this.dom.exclusionsBtn.node()))
	}

	self.setFilterBtn = function(div, label, prefix) {
		const btnName = prefix + 'Btn'
		const tipName = prefix + 'Tip'
		const divName = prefix + 'Div'

		this.dom[btnName] = div
			.append('div')
			.attr('class', 'sja_filter_btn')
			.style('display', 'inline-block')
			.style('padding', '5px')
			.style('margin', '3px 10px')
			.style('background', '#ececec')
			.style('cursor', 'pointer')
			.html(label)

		this.dom[tipName] = new client.Menu({ padding: '5px' })
		this.dom[divName] = this.dom[tipName].d
	}

	self.render = function() {
		const termfilter = self.state && self.state.termfilter
		if (termfilter && !termfilter.show_top_ui) {
			this.dom.holder.style('display', 'none')
			return
		}
		this.dom.holder.style('display', 'inline-block')

		self.inclusions.main(termfilter.inclusions ? termfilter.inclusions : termfilter.terms)
		const inum = termfilter.inclusions.length
		self.dom.inclusionsBtn.html(inum + ' inclusion' + (inum < 2 ? '' : 's') + ' criteria')

		self.exclusions.main(this.state.termfilter.exclusions)
		const xnum = termfilter.exclusions.length
		self.dom.exclusionsBtn.html(xnum + ' exclusion' + (xnum < 2 ? '' : 's') + ' criteria')
	}
}
