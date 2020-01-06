import * as rx from '../common/rx.core'
import { select, event } from 'd3-selection'
import { dofetch2, Menu } from '../client'
import * as dom from '../dom'
import { filterControlsInit } from '../common/filterControls'
import { filterGlanceInit } from '../common/filterGlance'
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
		setInteractivity(this)
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
		if (!this.filterGlance) this.initFilter()
		this.render()
	}

	initFilter() {
		this.filterGlance = filterGlanceInit({
			genome: this.state.genome,
			dslabel: this.state.dslabel,
			holder: this.dom.filterGlanceHolder,
			debug: this.app.opts.debug
		})

		this.filterControls = filterControlsInit({
			genome: this.state.genome,
			dslabel: this.state.dslabel,
			holder: this.dom.filterControlsTip.d,
			debug: this.app.opts.debug,
			callback: filter => {
				this.dom.filterControlsTip.hide()
				this.app.dispatch({
					type: 'filter_replace',
					filter
				})
			}
		})
	}
}

exports.filterInit = rx.getInitFxn(TdbFilter)

function setRenderers(self) {
	self.initHolder = function() {
		const div = self.dom.holder
			.attr('class', 'filter_div')
			.style('position', 'relative')
			.style('width', 'fit-content')
			//.style('padding', '5px')
			.style('margin', '10px')
			.style('margin-top', '5px')
			.style('display', 'table')
			.style('border', 'solid 1px #ddd')

		self.dom.filterBtn = div
			.append('div')
			.html('Filter')
			.style('display', 'inline-block')
			.style('padding', '5px 10px')
			.style('cursor', 'pointer')
			.on('click', self.displayControls)

		self.dom.filterGlanceHolder = div.append('div').style('display', 'inline-block')

		// filterUI mask
		div
			.append('div')
			.style('position', 'absolute')
			.style('top', 0)
			.style('left', 0)
			.style('width', '100%')
			.style('height', '100%')
			.on('click', self.displayControls)

		self.dom.filterControlsTip = new client.Menu({ padding: '5px' })
	}

	self.render = function() {
		const termfilter = self.state && self.state.termfilter
		if (termfilter && !termfilter.show_top_ui) {
			this.dom.holder.style('display', 'none')
			return
		}
		this.dom.holder.style('display', 'inline-block')
		self.filterGlance.main(termfilter.filter)
		self.filterControls.main(termfilter.filter)
	}
}

function setInteractivity(self) {
	self.displayControls = function() {
		self.dom.filterControlsTip.showunder(self.dom.holder.node())
	}
}
