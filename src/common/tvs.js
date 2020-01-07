import * as rx from './rx.core'
import { select, event } from 'd3-selection'
import { dofetch2, Menu } from '../client'
import * as dom from '../dom'
import { appInit } from '../termdb/app'
import * as client from '../client'

class TVS {
	constructor(opts) {
		this.opts = this.validateOpts(opts)
		this.genome = opts.genome
		this.dslabel = opts.dslabel
		this.dom = { holder: opts.holder, control_holder: opts.control_holder, tip: new Menu({ padding: '5px' }) }
		this.durations = { exit: 500 }

		setRenderers(this)
		setInteractivity(this)

		this.categoryData = {}

		this.api = {
			main: async (data = {}) => {
				this.term = data
				this.updateUI()

				// when there are filters to be removed, must account for the delayed
				// removal after opacity transition, as btn count will decrease only
				// after the transition and remove() is done
				//
				// !!! TODO: how to pass bus.emit('postRender') delay to rx.component.api.update()
				// this.bus.emit('postRender', null, filters.exit().size() ? this.durations.exit + 100 : 0)
			},
			getTerm: () => this.term
		}
	}
	validateOpts(o) {
		if (!o.holder) throw '.holder missing'
		if (!o.genome) throw '.genome missing'
		if (!o.dslabel) throw '.dslabel missing'
		if (typeof o.callback != 'function') throw '.callback() is not a function'
		return o
	}

	async getCategories(term, lst) {
		let tvslst_filter_str = false

		if (this.termfilter) {
			tvslst_filter_str = encodeURIComponent(JSON.stringify(this.term))
		}

		const args = [
			'genome=' +
				this.genome +
				'&dslabel=' +
				this.dslabel +
				'&getcategories=1&tid=' +
				term.id +
				'&tvslst=' +
				tvslst_filter_str
		]
		if (lst) args.push(...lst)

		let data
		try {
			data = await dofetch2('/termdb?' + args.join('&'), {})
			if (data.error) throw data.error
		} catch (e) {
			window.alert(e.message || e)
		}
		return data
	}
}

exports.TVSInit = rx.getInitFxn(TVS)

function setRenderers(self) {
	self.updateUI = function() {
		const terms_div = self.dom.holder
		const filters = terms_div.selectAll('.tvs_pill').data([self.term], d => d.term.id)
		filters.exit().each(self.exitPill)
		filters.each(self.updatePill)
		filters
			.enter()
			.append('div')
			.attr('class', 'tvs_pill sja_filter_tag_btn')
			.style('white-space', 'nowrap')
			.style('display', 'inline-block')
			.style('padding', '2px')
			.transition()
			.duration(200)
			.each(self.enterPill)
	}

	self.enterPill = async function() {
		const one_term_div = select(this)
			.style('font-size', '.9em')
			.on('click', self.showMenu)

		//term name div
		one_term_div
			.append('div')
			.attr('class', 'term_name_btn')
			.style('display', 'inline-block')
			.style('border-radius', '6px 0 0 6px')
			.style('background-color', '#396C98')
			.style('color', 'white')
			.style('padding', '6px 6px 3px 6px')
			.html(self.term_name_gen)
			.style('text-transform', 'uppercase')

		// // negate button
		one_term_div
			.append('div')
			.attr('class', 'negate_btn')
			.style('display', 'inline-block')
			.style('padding', '6px 6px 3px 6px')
			.style('background', d => (d.term.isnot ? '#660000' : '#134f5c'))
			.style('color', 'white')
			.html(d => (d.term.isnot ? 'NOT' : 'IS'))

		self.updatePill.call(this)
	}

	self.showMenu = d => {
		const term = d.term
		const control_tip = self.dom.control_holder
		const control_tip_dom = control_tip.node().getBoundingClientRect()
		control_tip.style('opacity', '0')
		self.dom.tip.clear().show(control_tip_dom.left - 20, control_tip_dom.top - 20)

		const header_div = self.dom.tip.d.append('div')
		const term_negate_div = self.dom.tip.d.append('div')
		const term_option_div = self.dom.tip.d.append('div')
		const term_edit_div = self.dom.tip.d.append('div').style('text-align', 'center')

		header_div
			.append('div')
			.attr('class', 'back_btn sja_menuoption')
			.style('display', 'inline-block')
			.style('border-radius', '13px')
			.style('padding', '7px 15px')
			.style('margin', '5px')
			.style('text-align', 'center')
			.style('font-size', '.8em')
			.style('text-transform', 'uppercase')
			.html('&#10094; Back')
			.on('click', () => {
				self.dom.tip.hide()
				control_tip.style('opacity', '1')
			})

		header_div
			.append('div')
			.style('padding-bottom', '5px')
			.style('margin', '5px')
			.style('font-size', '.8em')
			.style('font-style', 'italic')
			.style('color', '#888')
			.html('Configuring ' + term.name)

		const term_negate_select = term_negate_div
			.append('select')
			.attr('class', 'negate_select')
			.style('display', 'block')
			.style('margin', '5px 10px')
			.style('padding', '3px')
			.on('change', () => {
				const new_term = JSON.parse(JSON.stringify(d))
				new_term.term.isnot = term_negate_select.node().value == 'not' ? true : false
				self.dom.tip.hide()
				self.opts.callback(new_term)
			})

		term_negate_select
			.append('option')
			.attr('value', 'is')
			.text('IS')

		term_negate_select
			.append('option')
			.attr('value', 'not')
			.text('IS NOT')

		term_negate_select.node().selectedIndex = term.isnot ? 1 : 0

		const optsFxn = term.iscategorical
			? self.showCatOpts
			: term.isfloat || term.isinteger
			? self.showNumOpts
			: term.iscondition
			? self.showConditionOpts
			: null

		term_option_div
			.append('div')
			.style('margin', '5px 2px')
			.style('text-align', 'center')

		optsFxn(term_option_div, d)

		if (!self.opts.disable_ReplaceRemove) {
			term_edit_div
				.append('div')
				.attr('class', 'replace_btn sja_filter_tag_btn')
				.style('display', 'inline-block')
				.style('border-radius', '13px')
				.style('background-color', '#74b9ff')
				.style('padding', '7px 15px')
				.style('margin', '5px')
				.style('text-align', 'center')
				.style('font-size', '.8em')
				.style('text-transform', 'uppercase')
				.text('Replace')
				.on('click', self.displayTreeMenu)
			term_edit_div
				.append('div')
				.attr('class', 'remove_btn sja_filter_tag_btn')
				.style('display', 'inline-block')
				.style('border-radius', '13px')
				.style('background-color', '#ff7675')
				.style('padding', '7px 15px')
				.style('margin', '5px')
				.style('text-align', 'center')
				.style('font-size', '.8em')
				.style('text-transform', 'uppercase')
				.text('Remove')
				// .on('click', self.removeTerm)
				.on('click', () => {
					self.dom.tip.hide()
					self.removeTerm(d)
				})
		}
	}

	self.showCatOpts = async function(div, term) {
		let lst
		lst = term.bar_by_grade ? ['bar_by_grade=1'] : term.bar_by_children ? ['bar_by_children=1'] : []

		lst.push(
			term.value_by_max_grade
				? 'value_by_max_grade=1'
				: term.value_by_most_recent
				? 'value_by_most_recent=1'
				: term.value_by_computable_grade
				? 'value_by_computable_grade=1'
				: null
		)

		const data = await self.getCategories(term.term, lst)
		const sortedVals = data.lst.sort((a, b) => {
			return b.samplecount - a.samplecount
		})

		// 'Apply' button
		div
			.append('div')
			.style('text-align', 'center')
			.append('div')
			.attr('class', 'apply_btn sja_filter_tag_btn')
			.style('display', 'inline-block')
			.style('border-radius', '13px')
			.style('background-color', '#23cba7')
			.style('padding', '7px 15px')
			.style('margin', '5px')
			.style('text-align', 'center')
			.style('font-size', '.8em')
			.style('text-transform', 'uppercase')
			.text('Apply')
			.on('click', () => {
				//update term values by ckeckbox values
				let checked_vals = []
				values_table
					.selectAll('.value_checkbox')
					.filter(function(d) {
						return this.checked == true
					})
					.each(function(d) {
						checked_vals.push(this.value)
					})

				const new_vals = []

				for (const [i, v] of sortedVals.entries()) {
					for (const [j, sv] of checked_vals.entries()) {
						if (v.key == sv) new_vals.push(v)
					}
				}
				const new_term = JSON.parse(JSON.stringify(term))
				new_term.values = new_vals
				self.dom.tip.hide()
				self.opts.callback(new_term)
			})

		const values_table = self.makeValueTable(div, term, sortedVals)
	}

	self.showNumOpts = async function(div, term) {
		const ranges = []

		for (const [index, range] of term.ranges.entries()) {
			if (range.value == undefined) {
				ranges.push(range)
			}
		}

		const range_divs = div.selectAll('.range_div').data(ranges, d => (d.start ? d.start : d.stop ? d.stop : d))

		range_divs.exit().each(() => {
			select(this)
				.style('opacity', 1)
				.transition()
				.duration(self.durations.exit)
				.style('opacity', 0)
				.remove()
		})

		range_divs.each(function(d) {
			const div = select(this)
			const range = JSON.parse(JSON.stringify(d))

			div.select('start_input').attr('value', range.start)
			div.select('start_select').node().selectedIndex = range.startunbounded ? 2 : range.startinclusive ? 0 : 1
			div.select('stop_input').attr('value', range.stop)
			div.select('stop_select').node().selectedIndex = range.stopunbounded ? 2 : range.stopinclusive ? 0 : 1
		})

		range_divs
			.enter()
			.append('div')
			.attr('class', 'range_div')
			.style('white-space', 'nowrap')
			.style('display', 'block')
			.style('padding', '2px')
			.transition()
			.duration(200)
			.each(enter_range)

		div
			.append('div')
			.style('text-align', 'center')
			.append('div')
			.attr('class', 'add_btn sja_menuoption')
			.style('border-radius', '10px')
			.style('padding', '7px 6px')
			.style('margin', '5px')
			.style('text-align', 'center')
			.style('font-size', '.8em')
			.text('Add Interval')
			.on('click', () => {
				//Add new blank range temporary, save after entering values
				const new_term = JSON.parse(JSON.stringify(term))
				const range_temp = { start: '', stop: '' }
				new_term.ranges.push(range_temp)
				div.selectAll('*').remove()
				self.showNumOpts(div, new_term)
			})

		function enter_range(d, i) {
			const range_div = select(this)
			const range = JSON.parse(JSON.stringify(d))

			const equation_div = range_div
				.append('div')
				.style('display', 'block')
				.style('padding', '3px 5px')

			const start_input = equation_div
				.append('input')
				.attr('type', 'number')
				.attr('value', range.start)
				.attr('class', 'start_input')
				.style('width', '60px')
				.on('keyup', async () => {
					if (!client.keyupEnter()) return
					start_input.property('disabled', true)
					await apply()
					start_input.property('disabled', false)
				})

			// to replace operator_start_div
			const startselect = equation_div
				.append('select')
				.attr('class', 'start_select')
				.style('margin-left', '10px')

			startselect.append('option').html('&le;')
			startselect.append('option').html('&lt;')
			startselect.append('option').html('&#8734;')

			startselect.node().selectedIndex = range.startunbounded ? 2 : range.startinclusive ? 0 : 1

			const x = '<span style="font-family:Times;font-style:italic">x</span>'

			equation_div
				.append('div')
				.style('display', 'inline-block')
				.style('padding', '3px 10px')
				.html(x)

			// to replace operator_end_div
			const stopselect = equation_div
				.append('select')
				.attr('class', 'stop_select')
				.style('margin-right', '10px')

			stopselect.append('option').html('&le;')
			stopselect.append('option').html('&lt;')
			stopselect.append('option').html('&#8734;')

			stopselect.node().selectedIndex = range.stopunbounded ? 2 : range.stopinclusive ? 0 : 1

			const stop_input = equation_div
				.append('input')
				.attr('type', 'number')
				.attr('class', 'stop_input')
				.style('width', '60px')
				.attr('value', range.stop)
				.on('keyup', async () => {
					if (!client.keyupEnter()) return
					stop_input.property('disabled', true)
					await apply()
					stop_input.property('disabled', false)
				})

			//'Apply' button
			equation_div
				.append('div')
				.attr('class', 'sja_filter_tag_btn apply_btn')
				.style('display', 'inline-block')
				.style('border-radius', '13px')
				.style('background-color', '#23cba7')
				.style('color', '#fff')
				.style('margin', '5px')
				.style('margin-left', '10px')
				.style('padding', '7px 15px')
				.style('text-align', 'center')
				.style('font-size', '.8em')
				.style('text-transform', 'uppercase')
				.text('apply')
				.on('click', async () => {
					self.dom.tip.hide()
					await apply()
				})

			//'Delete' button
			equation_div
				.append('div')
				.attr('class', 'sja_filter_tag_btn delete_btn')
				.style('display', 'inline-block')
				.style('border-radius', '13px')
				.style('background-color', '#ff7675')
				.style('color', '#fff')
				.style('margin', '5px')
				.style('margin-left', '10px')
				.style('padding', '7px 15px')
				.style('text-align', 'center')
				.style('font-size', '.8em')
				.style('text-transform', 'uppercase')
				.text('Delete')
				.on('click', async () => {
					// self.dom.tip.hide()
					const new_term = JSON.parse(JSON.stringify(term))
					const range_delete = new_term.ranges[i]
					if (range_delete.start || range_delete.stop) {
						self.dom.tip.hide()
						if (new_term.ranges.length > 1) {
							new_term.ranges.splice(i, 1)
							self.opts.callback(new_term)
						} else self.opts.callback(null)
					} else {
						new_term.ranges.splice(i, 1)
						div.selectAll('*').remove()
						self.showNumOpts(div, new_term)
					}
				})

			// tricky: only show tip when contents are filled, so that it's able to detect its dimention and auto position itself
			// self.dom.tip.showunder(holder.node())

			async function apply() {
				try {
					if (startselect.node().selectedIndex == 2 && stopselect.node().selectedIndex == 2)
						throw 'Both ends can not be unbounded'

					const start = startselect.node().selectedIndex == 2 ? null : Number(start_input.node().value)
					const stop = stopselect.node().selectedIndex == 2 ? null : Number(stop_input.node().value)
					if (start != null && stop != null && start >= stop) throw 'start must be lower than stop'

					if (startselect.node().selectedIndex == 2) {
						range.startunbounded = true
						delete range.start
					} else {
						delete range.startunbounded
						range.start = start
						range.startinclusive = startselect.node().selectedIndex == 0
					}
					if (stopselect.node().selectedIndex == 2) {
						range.stopunbounded = true
						delete range.stop
					} else {
						delete range.stopunbounded
						range.stop = stop
						range.stopinclusive = stopselect.node().selectedIndex == 0
					}
					self.dom.tip.hide()
					const new_term = JSON.parse(JSON.stringify(term))
					new_term.ranges[i] = range
					self.opts.callback(new_term)
				} catch (e) {
					window.alert(e)
				}
			}
		}

		// numerical checkbox for unannotated cats
		const data = await self.getCategories(term.term)

		const unannotated_cats = { lst: [] }

		for (const [index, cat] of data.lst.entries()) {
			if (cat.range.value != undefined) {
				unannotated_cats.lst.push(cat)
			}
		}

		const sortedVals = unannotated_cats.lst.sort((a, b) => {
			return b.samplecount - a.samplecount
		})

		// // 'Apply' button
		div
			.append('div')
			.style('text-align', 'center')
			.append('div')
			.attr('class', 'apply_btn sja_filter_tag_btn')
			.style('display', 'inline-block')
			.style('border-radius', '13px')
			.style('background-color', '#23cba7')
			.style('padding', '7px 15px')
			.style('margin', '5px')
			.style('text-align', 'center')
			.style('font-size', '.8em')
			.style('text-transform', 'uppercase')
			.text('Apply')
			.on('click', () => {
				//update term values by ckeckbox values
				let checked_vals = []
				values_table
					.selectAll('.value_checkbox')
					.filter(function(d) {
						return this.checked == true
					})
					.each(function(d) {
						checked_vals.push(this.value)
					})

				const new_vals = []

				for (const [i, v] of sortedVals.entries()) {
					for (const [j, sv] of checked_vals.entries()) {
						if (v.key == sv) new_vals.push({ value: v.range.value })
					}
				}
				const new_term = JSON.parse(JSON.stringify(term))
				if (new_vals.length > 0 && (term.term.isinteger || term.term.isfloat)) {
					for (const [i, d] of new_vals.entries()) {
						if (!new_term.ranges.map(a => a.value).includes(d.value)) new_term.ranges.push({ value: d.value })
					}
				}

				for (const [i, d] of new_term.ranges.entries()) {
					if (d.value && !new_vals.map(a => a.value).includes(d.value)) new_term.ranges.splice(i, 1)
				}

				self.dom.tip.hide()
				self.opts.callback(new_term)
			})

		const values_table = self.makeValueTable(div, term, sortedVals)
	}

	self.showConditionOpts = async function(div, term) {
		// grade/subcondtion select
		const value_type_select = div
			.append('select')
			.attr('class', '.value_select')
			.style('display', 'block')
			.style('margin', '5px 10px')
			.style('padding', '3px')
			.on('change', () => {
				const new_term = JSON.parse(JSON.stringify(term))
				new_term.bar_by_grade = value_type_select.node().value == 'grade' ? true : false
				new_term.bar_by_children = value_type_select.node().value == 'sub' ? true : false
				div.selectAll('*').remove()
				self.showConditionOpts(div, new_term)
			})

		value_type_select
			.append('option')
			.attr('value', 'grade')
			.text('By Grade')

		value_type_select
			.append('option')
			.attr('value', 'sub')
			.text('By Subcondition')

		value_type_select.node().selectedIndex = term.bar_by_children ? 1 : 0

		// grade type type
		const grade_type_select = div
			.append('select')
			.attr('class', '.grade_select')
			.style('margin', '5px 10px')
			.style('padding', '3px')
			.style('display', term.bar_by_grade ? 'block' : 'none')
			.on('change', () => {
				const new_term = JSON.parse(JSON.stringify(term))

				new_term.bar_by_grade = grade_type_select.node().value == 'sub' ? false : true
				new_term.bar_by_children = grade_type_select.node().value == 'sub' ? true : false
				new_term.value_by_max_grade = grade_type_select.node().value == 'max' ? true : false
				new_term.value_by_most_recent = grade_type_select.node().value == 'recent' ? true : false
				new_term.value_by_computable_grade =
					grade_type_select.node().value == 'computable' || grade_type_select.node().value == 'sub' ? true : false

				self.dom.tip.hide()
				self.opts.callback(new_term)
			})

		grade_type_select
			.append('option')
			.attr('value', 'max')
			.text('Max grade per patient')

		grade_type_select
			.append('option')
			.attr('value', 'recent')
			.text('Most recent grade per patient')

		grade_type_select
			.append('option')
			.attr('value', 'computable')
			.text('Any grade per patient')

		grade_type_select.node().selectedIndex = term.value_by_computable_grade ? 2 : term.value_by_most_recent ? 1 : 0

		// display note if bar by subcondition selected
		div
			.append('span')
			.style('margin', '5px 10px')
			.style('padding', '3px')
			.style('display', term.bar_by_children ? 'block' : 'none')
			.style('color', '#888')
			.html('Using any grade per patient')

		let lst
		lst = term.bar_by_grade ? ['bar_by_grade=1'] : term.bar_by_children ? ['bar_by_children=1'] : []

		lst.push(
			term.value_by_max_grade
				? 'value_by_max_grade=1'
				: term.value_by_most_recent
				? 'value_by_most_recent=1'
				: term.value_by_computable_grade
				? 'value_by_computable_grade=1'
				: null
		)

		const data = await self.getCategories(term.term, lst)

		// 'Apply' button
		div
			.append('div')
			.style('text-align', 'center')
			.append('div')
			.attr('class', 'apply_btn sja_filter_tag_btn')
			.style('display', 'inline-block')
			.style('border-radius', '13px')
			.style('background-color', '#23cba7')
			.style('padding', '7px 15px')
			.style('margin', '5px')
			.style('text-align', 'center')
			.style('font-size', '.8em')
			.style('text-transform', 'uppercase')
			.text('Apply')
			.on('click', () => {
				//update term values by ckeckbox values
				let checked_vals = []
				values_table
					.selectAll('.value_checkbox')
					.filter(function(d) {
						return this.checked == true
					})
					.each(function(d) {
						checked_vals.push(this.value)
					})

				const new_vals = []

				for (const [i, v] of data.lst.entries()) {
					for (const [j, sv] of checked_vals.entries()) {
						if (v.key == sv) new_vals.push(v)
					}
				}
				const new_term = JSON.parse(JSON.stringify(term))
				new_term.values = new_vals
				self.dom.tip.hide()
				self.opts.callback(new_term)
			})

		const values_table = self.makeValueTable(div, term, data.lst)
	}

	self.removeTerm = term => {
		// const termfilter = self.termfilter.terms.filter(d => d.term.id != term.term.id)
		self.opts.callback(null)
	}

	self.updatePill = async function() {
		const one_term_div = select(this)
		const term = one_term_div.datum()

		// negate button
		one_term_div
			.select('.negate_btn')
			.style('background', d => (d.term.isnot ? '#660000' : '#134f5c'))
			.html(d => (d.term.isnot ? 'NOT' : 'IS'))

		const value_text = self.get_value_text(term)

		const grade_type =
			term.bar_by_grade && term.value_by_max_grade
				? '[Max Grade]'
				: term.bar_by_grade && term.value_by_most_recent
				? '[Most Recent Grade]'
				: term.bar_by_grade && term.value_by_computable_grade
				? '[Any Grade]'
				: ''

		const value_btns = one_term_div
			.selectAll('.value_btn')
			.data(value_text ? [{ txt: value_text, grade_type }] : [], d => d.txt + d.grade_type)

		value_btns.exit().each(self.removeValueBtn)

		value_btns
			.enter()
			.append('div')
			.attr('class', 'value_btn')
			.style('display', 'inline-block')
			.style('padding', '6px 6px 3px 6px')
			.style('border-radius', '0 6px 6px 0')
			.style('background', '#4888BF')
			.style('color', 'white')
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

	self.get_value_text = function(term) {
		const valueData = term.term.iscategorical
			? term.values
			: term.term.isfloat || term.term.isinteger
			? term.ranges
			: term.bar_by_grade || term.bar_by_children
			? term.values
			: term.grade_and_child

		if (term.term.iscategorical) {
			if (term.values.length == 1) return term.values[0].label
			else return term.values.length + ' Groups'
		} else if (term.term.isfloat || term.term.isinteger) {
			if (term.ranges.length == 1 && term.ranges[0].value) return '1 Category'
			else if (term.ranges.length == 1) return self.numeric_val_text(term.ranges[0])
			else return term.ranges.length + ' Intervals'
		} else if (term.bar_by_grade || term.bar_by_children) {
			if (term.values.length == 1) return term.values[0].label
			else return term.values.length + (term.bar_by_grade ? ' Grades' : term.bar_by_children ? ' Subconditions' : '')
		} else if (term.grade_and_child) {
			//TODO
		} else {
			return 'Unknown term value setting'
		}
		return null
	}

	self.exitPill = async function(term) {
		select(this)
			.style('opacity', 1)
			.transition()
			.duration(self.durations.exit)
			.style('opacity', 0)
			.remove()
	}

	self.makeValueTable = function(div, term, values) {
		const values_table = div.append('table').style('border-collapse', 'collapse')

		// this row will have group names/number
		const all_checkbox_tr = values_table.append('tr').style('height', '20px')

		const all_checkbox = all_checkbox_tr
			.append('td')
			.style('padding', '2px 5px')
			.append('input')
			.attr('type', 'checkbox')
			.style('position', 'relative')
			.style('vertical-align', 'middle')
			.style('bottom', '3px')
			.on('change', () => {
				values_table.selectAll('.value_checkbox').property('checked', all_checkbox.node().checked)
			})

		all_checkbox_tr
			.append('td')
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

			value_tr
				.append('td')
				.style('padding', '2px 5px')
				.append('input')
				.attr('class', 'value_checkbox')
				.attr('type', 'checkbox')
				.attr('value', d.key)
				.style('position', 'relative')
				.style('vertical-align', 'middle')
				.style('bottom', '3px')
				.property('checked', () => {
					if (term.term.iscategorical && term.values.map(a => a.label).includes(d.label)) {
						return true
					} else if (
						(term.term.isfloat || term.term.isinteger) &&
						term.ranges.map(a => a.value).includes(d.range.value)
					) {
						return true
					} else if (term.term.iscondition && term.values.map(a => a.label).includes(d.label)) {
						return true
					}
				})

			value_tr
				.append('td')
				.style('padding', '2px 5px')
				.style('font-size', '.8em')
				.html(d.label + ' (n=' + d.samplecount + ')')
		}
		return values_table
	}

	self.removeValueBtn = function(d, j) {
		const one_term_div = select(this.parentNode)
		const term = one_term_div.datum()
		const select_remove_pos =
			term.term.isinteger || term.term.isfloat ? j - term.ranges.slice(0, j).filter(a => a.start || a.stop).length : j

		select(one_term_div.selectAll('.value_select')._groups[0][select_remove_pos]).remove()
		select(one_term_div.selectAll('.or_btn')._groups[0][j]).remove()
		select(this)
			.style('opacity', 1)
			.transition()
			.duration(self.durations.exit)
			.style('opacity', 0)
			.remove()
	}

	self.makeSelectList = function(data, select, selected_values, btn_value, first_option) {
		if (data.lst) {
			if (first_option == 'delete') {
				select
					.append('option')
					.attr('value', 'delete')
					.html('&times;&nbsp;&nbsp;Delete')
			} else if (first_option == 'add') {
				select
					.append('option')
					.attr('value', 'add')
					.property('disabled', true)
					.html('--- Add New Category ---')
			}

			for (const category of data.lst) {
				select
					.append('option')
					.attr('value', category.key)
					.text(category.label + '\t(n=' + category.samplecount + ')')
			}

			//if more than 1 categories exist, disable other from the dropdown to avoid duplicate selection
			if (btn_value) {
				const options = select.selectAll('option')

				options.nodes().forEach(function(d) {
					if (selected_values.find(v => v.key == d.value) && d.value != btn_value) {
						d.disabled = true
					}
				})

				select.node().value = btn_value
			}
		} else {
			select.append('option').text("ERROR: Can't get the data")
		}
	}

	self.updateSelect = function(select, selected_values, btn_value) {
		const options = select.selectAll('option')

		options.nodes().forEach(function(d) {
			if (
				selected_values.length > 0 &&
				selected_values.find(v => (v.key || v.label) == d.value) &&
				d.value != btn_value
			) {
				d.disabled = true
			} else {
				d.disabled = false
			}
			select.node().value = btn_value
		})
	}

	self.term_name_gen = function(d) {
		let term_name = d.term.name

		// trim long term name with '...' at end and hover to see full term_name
		if ((d.term.isfloat || d.term.isinteger) && d.term.name.length > 25) {
			term_name = '<label title="' + d.term.name + '">' + d.term.name.substring(0, 24) + '...' + '</label>'
		} else if (d.term.iscondition && d.term.name.length > 20) {
			term_name = '<label title="' + d.term.name + '">' + d.term.name.substring(0, 18) + '...' + '</label>'
		}
		return term_name
	}

	self.numeric_val_text = function(range) {
		let range_txt
		const x = '<span style="font-family:Times;font-style:italic;font-size:0.9em;">x</span>'
		if (range.startunbounded) {
			range_txt = x + ' ' + (range.stopinclusive ? '&le;' : '&lt;') + ' ' + range.stop
		} else if (range.stopunbounded) {
			range_txt = x + ' ' + (range.startinclusive ? '&ge;' : '&gt;') + ' ' + range.start
		} else {
			range_txt =
				range.start +
				' ' +
				(range.startinclusive ? '&le;' : '&lt;') +
				' ' +
				x +
				' ' +
				(range.stopinclusive ? '&le;' : '&lt;') +
				' ' +
				range.stop
		}
		return range_txt
	}
}

function setInteractivity(self) {
	self.displayTreeMenu = holder => {
		self.dom.tip.clear().showunder(holder || self.dom.holder.node())
		// const one_term_div = self.dom.holder.selectAll('div')
		// const terms = one_term_div.classed('add_term_btn')
		// 	? self.termfilter.terms
		// 	: self.termfilter.terms.filter(t => t.id != term.termId)
		appInit(null, {
			holder: self.dom.tip.d,
			state: {
				genome: self.genome,
				dslabel: self.dslabel,
				termfilter: {
					show_top_ui: false
					// 	terms: terms
				}
			},
			modifiers: {
				//modifier to replace filter by clicking term btn
				//TODO: add tvs as new filter from '+' button
				tvs_select: tvs => {
					self.replaceFilter({ term: tvs })
				}
			},
			app: {
				callbacks: { 'postInit.test': () => {} }
			},
			barchart: {
				bar_click_override: tvslst => {
					self.dom.tip.hide()
					self.opts.callback(tvslst[0])
				}
			}
		})
	}

	// self.updateGradeType = opts =>
	// 	self.app.dispatch({ type: 'filter_grade_update', termId: opts.term.id, updated_term: opts.updated_term })

	// self.removeFilter = term => self.app.dispatch({ type: 'filter_remove', termId: term.id })

	// self.filterNegate = term => self.app.dispatch({ type: 'filter_negate', termId: term.id })

	// self.addValue = opts => self.app.dispatch({ type: 'filter_add', termId: opts.term.id, value: opts.new_value })

	// self.changeValue = opts =>
	// 	self.app.dispatch({ type: 'filter_value_change', termId: opts.term.id, value: opts.value, valueId: opts.j })

	// self.removeValue = opts => self.app.dispatch({ type: 'filter_value_remove', termId: opts.term.id, valueId: opts.j })

	// self.replaceFilter = opts => self.app.dispatch({ type: 'filter_replace', term: opts.term })
}
