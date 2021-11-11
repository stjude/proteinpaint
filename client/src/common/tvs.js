import * as rx from './rx.core'
import { select } from 'd3-selection'
import * as client from '../client'
import { getCategoricalMethods } from './tvs.categorical'
import { getConditionMethods } from './tvs.conditional'
import { getNumericMethods } from './tvs.numeric'

class TVS {
	constructor(opts) {
		this.opts = this.validateOpts(opts)
		this.dom = { holder: opts.holder, controlsTip: opts.controlsTip, tip: new client.Menu({ padding: '5px' }) }
		this.durations = { exit: 0 }

		setInteractivity(this)
		setRenderers(this)
		this.categoryData = {}

		this.methodsByTermType = {
			categorical: getCategoricalMethods(this),
			integer: getNumericMethods(this),
			float: getNumericMethods(this),
			condition: getConditionMethods(this)
		}

		this.api = {
			main: async (data = {}) => {
				this.tvs = data.tvs
				this.filter = data.filter
				if (!(this.tvs.term.type in this.methodsByTermType)) throw `invalid tvs.term.type='${this.tvs.term.type}'`
				this.updateUI()

				// when there are filters to be removed, must account for the delayed
				// removal after opacity transition, as btn count will decrease only
				// after the transition and remove() is done
				//
				// !!! TODO: how to pass bus.emit('postRender') delay to rx.component.api.update()
				// this.bus.emit('postRender', null, filters.exit().size() ? this.durations.exit + 100 : 0)
			},
			showMenu: this.showMenu
		}
	}
	validateOpts(o) {
		if (!o.holder) throw '.holder missing'
		if (!o.vocabApi) throw '.vocabApi missing'
		if (typeof o.callback != 'function') throw '.callback() is not a function'
		return o
	}
}

export const TVSInit = rx.getInitFxn(TVS)

function setRenderers(self) {
	self.updateUI = function() {
		const terms_div = self.dom.holder
		/*
			Currently, only a single pill per tvs is rendered, so using the 
			array [self.tvs] may seem unnecessary. However, using the
			enter/update/exit pattern helps with coding consistency across components,
			and more clearly indicates whether the whole pill is replaced
			or if only its values are updated.
		*/
		const filters = terms_div.selectAll('.tvs_pill').data([self.tvs], d => d.term.id)
		filters.exit().each(self.exitPill)
		filters.each(self.updatePill)
		filters
			.enter()
			.append('div')
			.attr('class', 'tvs_pill')
			.style('white-space', 'nowrap')
			.style('display', 'inline-block')
			.transition()
			.duration(200)
			.each(self.enterPill)
	}

	self.enterPill = async function() {
		const one_term_div = select(this).style('font-size', '.9em')

		//term name div
		one_term_div
			.append('div')
			.attr('class', 'term_name_btn sja_filter_tag_btn')
			.style('display', 'inline-block')
			.style('border-radius', '6px 0 0 6px')
			.style('padding', '6px 6px 3px 6px')
			.html(self.methodsByTermType[self.tvs.term.type].term_name_gen)
			.style('text-transform', 'uppercase')

		// negate button
		one_term_div
			.append('div')
			.attr('class', 'negate_btn')
			.style('cursor', 'default')
			//.style('display', 'inline-block' : 'none')
			.style('padding', '6px 6px 3px 6px')
			.style('background', self.tvs.isnot ? '#f4cccc' : '#a2c4c9')
			.html(self.tvs.isnot ? 'NOT' : 'IS')

		self.updatePill.call(this)
	}

	// optional _holder, for example when called by filter.js
	self.showMenu = _holder => {
		const holder = _holder ? _holder : self.dom.tip
		const term = self.tvs.term
		self.methodsByTermType[self.tvs.term.type].fillMenu(holder, self.tvs)
	}

	self.removeTerm = tvs => {
		// const termfilter = self.termfilter.terms.filter(d => d.term.id != tvs.term.id)
		self.opts.callback(null)
	}

	self.updatePill = async function() {
		const one_term_div = select(this)
		const tvs = one_term_div.datum()
		const lstlen = (self.tvs.values && self.tvs.values.length) || (self.tvs.ranges && self.tvs.ranges.length)

		// negate button
		one_term_div
			.select('.negate_btn')
			.style('display', lstlen ? 'inline-block' : 'none')
			.style('background', self.tvs.isnot ? '#f4cccc' : '#a2c4c9')
			.html(tvs.isnot ? 'NOT' : 'IS')

		const label = self.methodsByTermType[self.tvs.term.type].get_pill_label(tvs)
		if (!('grade_type' in label)) label.grade_type = ''

		const value_btns = one_term_div.selectAll('.value_btn').data(label ? [label] : [], d => d.txt + d.grade_type)

		value_btns.exit().each(self.removeValueBtn)

		value_btns
			.enter()
			.append('div')
			.attr('class', 'value_btn sja_filter_tag_btn')
			.style('display', lstlen ? 'inline-block' : 'none')
			.style('padding', '6px 6px 3px 6px')
			.style('border-radius', '0 6px 6px 0')
			.style('font-style', 'italic')
			.html(d => d.txt)
			.append('div')
			.attr('class', 'grade_type_btn')
			.style('display', 'inline-block')
			.style('margin', '0 5px')
			.style('font-size', '.6em')
			.style('text-transform', 'uppercase')
			.html(d => d.grade_type)
			.style('opacity', 0)
			.transition()
			.duration(200)
			.style('opacity', 1)
	}

	self.exitPill = async function(term) {
		select(this)
			.style('opacity', 1)
			.transition()
			.duration(self.durations.exit)
			.style('opacity', 0)
			.remove()
	}

	self.makeValueTable = function(div, tvs, values) {
		const values_table = div.append('table').style('border-collapse', 'collapse')

		// this row will have group names/number
		const all_checkbox_tr = values_table.append('tr').style('height', '20px')

		const all_checkbox_label = all_checkbox_tr.append('td').style('padding', '2px 5px')

		const all_checkbox = all_checkbox_label
			.append('input')
			.attr('type', 'checkbox')
			.style('position', 'relative')
			.style('vertical-align', 'middle')
			.style('bottom', '3px')
			.on('change', () => {
				values_table
					.selectAll('.value_checkbox')
					.property('checked', all_checkbox.node().checked)
					.dispatch('change')
			})

		all_checkbox_label
			.append('span')
			.style('padding', '2px 5px')
			.style('font-size', '.8em')
			.style('font-weight', 'bold')
			.html('Check/ Uncheck All')

		const value_trs = values_table.selectAll('.value_tr').data(values, d => d.key)

		value_trs
			.exit()
			.style('opacity', 1)
			.transition()
			.duration(self.durations.exit)
			.style('opacity', 0)
			.remove()

		value_trs
			.enter()
			.append('tr')
			.attr('class', 'value_tr')
			.style('height', '15px')
			.style('opacity', 0)
			.transition()
			.duration(200)
			.style('opacity', 1)
			.each(enter_td)

		function enter_td(d) {
			const value_tr = select(this)

			const value_label = value_tr
				.append('td')
				.style('padding', '2px 5px')
				.append('label')

			value_label
				.append('input')
				.attr('class', 'value_checkbox')
				.attr('type', 'checkbox')
				.attr('value', 'key' in d ? d.key : d.value)
				.style('position', 'relative')
				.style('vertical-align', 'middle')
				.style('bottom', '3px')
				.property('checked', () => {
					if (tvs.term.type == 'categorical') {
						return tvs.values.find(a => a.key === d.key)
					} else if (tvs.term.type == 'float' || tvs.term.type == 'integer') {
						return tvs.ranges.find(a => String(a.value) === d.value.toString())
					} else if (tvs.term.type == 'condition') {
						return tvs.values.find(a => String(a.key) === String(d.key))
					}
				})

			value_label
				.append('span')
				.style('padding', '2px 5px')
				.style('font-size', '.8em')
				.html(d.label + ' (n=' + d.samplecount + ')')
		}
		return values_table
	}

	self.removeValueBtn = function(d, j) {
		const one_term_div = select(this.parentNode)
		const tvs = one_term_div.datum()
		const select_remove_pos = self.methodsByTermType[self.tvs.term.type].getSelectRemovePos(j, tvs)

		select(one_term_div.selectAll('.value_select')._groups[0][select_remove_pos]).remove()
		select(one_term_div.selectAll('.or_btn')._groups[0][j]).remove()
		select(this)
			.style('opacity', 1)
			.transition()
			.duration(self.durations.exit)
			.style('opacity', 0)
			.remove()
	}
}

function setInteractivity(self) {
	// optional event handlers
}
