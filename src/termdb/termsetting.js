import * as rx from '../common/rx.core'
import { select, event } from 'd3-selection'
import { dofetch2, Menu } from '../client'
import * as dom from '../dom'
import { appInit } from './app'
import * as client from '../client'

class TermSetting {
	constructor(app, opts) {
		this.type = 'termsetting'
		this.id = opts.id
		this.api = rx.getComponentApi(this)
		this.app = app
		this.dom = { holder: opts.holder, tip: new Menu({ padding: '5px' }) }
		this.plot = opts.plot
		this.term_index = opts.term_id
		this.durations = { exit: 500 }
		this.appState = app.getState()

		setRenderers(this)
		setInteractivity(this)

		this.categoryData = {}
		this.initHolder()
		this.eventTypes = ['postInit', 'postRender']
	}

	getState(appState) {
		if (!(this.id in appState.tree.plots)) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		const config = appState.tree.plots[this.id]
		return {
			config: {
				term: config.term,
				term0: config.term0,
				term2: config.term2
			}
		}
	}

	main() {
		this.dom.tip.hide()

		const pill_term =
			this.term_index == 'term0'
				? this.state.config.term0
				: this.term_index == 'term1'
				? this.state.config.term
				: this.term_index == 'term2'
				? this.state.config.term2
				: null

		this.dom.add_term_div.style('display', !pill_term ? 'block' : 'none')
		this.dom.show_term_div.style('display', !pill_term ? 'none' : 'block')

		if (!pill_term) return

		const blue_pills = this.dom.show_term_div.selectAll('.ts_pill').data([pill_term], d => d.id)

		blue_pills.exit().each(this.exitPill)
		blue_pills.each(this.updatePill)
		blue_pills
			.enter()
			.append('div')
			.attr('class', 'ts_pill sja_filter_tag_btn')
			.style('white-space', 'nowrap')
			.style('display', 'inline-block')
			.style('padding', '2px')
			.transition()
			.duration(200)
			.each(this.enterPill)

		// when there are blue_pills to be removed, must account for the delayed
		// removal after opacity transition, as btn count will decrease only
		// after the transition and remove() is done
		this.bus.emit('postInit', null, blue_pills.exit().size() ? this.durations.exit + 100 : 0)
	}
}

exports.termSettingInit = rx.getInitFxn(TermSetting)

function setRenderers(self) {
	self.initHolder = function() {
		this.dom.add_term_div = this.dom.holder.append('div')
		this.dom.show_term_div = this.dom.holder.append('div')
		this.dom.add_term_div.append('span').html(self.mainlabel ? self.mainlabel + '&nbsp;' : 'Select term&nbsp;')

		// add new term
		this.dom.add_term_div
			.append('div')
			.attr('class', 'sja_filter_tag_btn add_term_btn')
			.style('padding', '3px 6px 3px 6px')
			.style('display', 'inline-block')
			.style('border-radius', '6px')
			.style('background-color', '#4888BF')
			.html('&#43;')
			.on('click', self.displayTreeMenu)
	}

	self.enterPill = async function(term) {
		// console.log('enter', term)

		const one_term_div = select(this)

		const menuFxn = term.term.iscategorical
			? self.displayCatMenu
			: term.term.isfloat || term.term.isinteger
			? self.displayNumMenu
			: term.term.iscondition
			? self.displayConditionMenu
			: null

		const term_name_btn = one_term_div
			.append('div')
			.attr('class', 'sja_filter_tag_btn term_name_btn')
			.style('border-radius', '6px')
			.style('background-color', '#4888BF')
			.style('padding', '7px 6px 5px 6px')
			.style('margin-left', '5px')
			.style('font-size', '.7em')
			.text(d => d.term.name)
			.style('text-transform', 'uppercase')
			.on('click', menuFxn)
	}

	self.updatePill = async function(term) {
		// console.log('update', term)
	}

	self.exitPill = async function(term) {
		// console.log('exit', term)

		select(this)
			.style('opacity', 1)
			.transition()
			.duration(self.durations.exit)
			.style('opacity', 0)
			.remove()
	}
}

function setInteractivity(self) {
	self.displayTreeMenu = async function(term) {
		const one_term_div = self.dom.holder.node()
		self.dom.tip.clear().showunder(one_term_div)
		const treediv = self.dom.tip.d.append('div')
		// set termfilter terms to all filter-terms if '+' or all except current term if 'term_name_btn'
		const terms = select(one_term_div).classed('add_term_btn')
			? self.appState.termfilter.terms
			: self.appState.termfilter.terms.filter(t => t.id != term.termId)

		// a new object as init() argument for launching the tree with modifiers
		const opts = {
			holder: treediv,
			state: {
				dslabel: self.appState.dslabel,
				genome: self.appState.genome,
				termfilter: {
					show_top_ui: false,
					terms: terms
				}
			},
			modifiers: {
				//TODO: add tvs as new filter from '+' button
				click_term: self.addPill
			},
			callbacks: {}
		}
		appInit(null, opts)
	}

	self.displayCatMenu = async function(term) {
		const one_term_div = this
		self.dom.tip.clear().showunder(one_term_div)
		const term_option_div = self.dom.tip.d.append('div')

		term_option_div
			.append('div')
			.style('margin', '5px')
			.style('text-align', 'center')
			.html('Categorical term options')

		self.addReplaceBtn(term_option_div)
		self.addRemoveBtn(term_option_div)
	}

	self.displayNumMenu = async function(term) {
		const one_term_div = this
		self.dom.tip.clear().showunder(one_term_div)
		const term_option_div = self.dom.tip.d.append('div')

		term_option_div
			.append('div')
			.style('margin', '5px')
			.style('text-align', 'center')
			.html('Nuermical term options')

		self.addReplaceBtn(term_option_div)
		self.addRemoveBtn(term_option_div)
	}

	self.displayConditionMenu = async function(term) {
		const one_term_div = this
		self.dom.tip.clear().showunder(one_term_div)
		const term_option_div = self.dom.tip.d.append('div')

		term_option_div
			.append('div')
			.style('margin', '5px')
			.style('text-align', 'center')
			.html('Conditional term options')

		self.addReplaceBtn(term_option_div)
		self.addRemoveBtn(term_option_div)
	}

	self.addReplaceBtn = function(div) {
		div
			.append('div')
			.attr('class', 'replace_btn sja_filter_tag_btn')
			.style('display', 'inline-block')
			.style('border-radius', '10px')
			.style('background-color', '#5bc0de')
			.style('padding', '7px 6px 5px 6px')
			.style('margin', '5px')
			.style('text-align', 'center')
			.style('width', '35%')
			.style('font-size', '.8em')
			.text('Replace')
			.on('click', self.displayTreeMenu)
	}

	self.addRemoveBtn = function(div) {
		div
			.append('div')
			.attr('class', 'replace_btn sja_filter_tag_btn')
			.style('display', 'inline-block')
			.style('border-radius', '10px')
			.style('background-color', '#f0ad4e')
			.style('padding', '7px 6px 5px 6px')
			.style('margin', '5px')
			.style('text-align', 'center')
			.style('width', '35%')
			.style('font-size', '.8em')
			.text('Remove')
			.on('click', self.removePill)
	}

	self.addPill = function(ts) {
		const radioName = self.term_index == 'term2' ? 'overlay' : self.term_index == 'term0' ? 'divideBy' : '' // barsAs does not have radio buttons

		const settings = !radioName
			? {}
			: {
					barchart: {
						[radioName]: 'tree'
					}
			  }

		self.app.dispatch({
			type: 'plot_edit',
			id: self.state.config.id,
			config: {
				[self.term_index]: {
					id: ts.id,
					term: ts
				},
				settings
			}
		})
	}

	self.removePill = function() {
		self.app.dispatch({
			type: 'plot_edit',
			id: self.id,
			config: {
				[self.term_index]: null
			}
		})
	}
}
