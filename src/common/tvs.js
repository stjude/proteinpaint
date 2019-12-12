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
		this.dom = { holder: opts.holder, tip: new Menu({ padding: '5px' }) }
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
			}
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
		// if (!self.termfilter.terms.length) {
		// 	// no term
		// 	self.dom.addpilldiv.style('display', 'inline-block')
		// 	self.dom.pilldiv.style('display', 'none')
		// } else {
		// 	self.dom.addpilldiv.style('display', 'none')
		// 	self.dom.pilldiv.style('display', 'inline-block')
		// }

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
			.style('padding', '6px 6px 3px 6px')
			.style('margin-left', '5px')
			.text(d => d.term.name)
			.style('text-transform', 'uppercase')

		self.updatePill.call(this)
	}

	self.showMenu = d => {
		const term = d.term
		self.dom.tip.clear().showunder(self.dom.holder.node())

		const term_option_div = self.dom.tip.d.append('div')
		const term_edit_div = self.dom.tip.d.append('div').style('text-align', 'center')

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
			.style('border-radius', '10px')
			.style('background-color', '#74b9ff')
			.style('padding', '7px 6px')
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
				self.opts.callback({
					type: 'filter_replace',
					term: new_term
				})
			})

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

		for (const [i, v] of sortedVals.entries()) {
			const value_tr = values_table.append('tr').style('height', '15px')

			value_tr
				.append('td')
				.style('padding', '2px 5px')
				.append('input')
				.attr('class', 'value_checkbox')
				.attr('type', 'checkbox')
				.attr('value', v.key)
				.style('position', 'relative')
				.style('vertical-align', 'middle')
				.style('bottom', '3px')
				.property('checked', () => {
					if (term.values.map(a => a.label).includes(v.label)) {
						return true
					}
				})

			value_tr
				.append('td')
				.style('padding', '2px 5px')
				.style('font-size', '.8em')
				.html(v.label + ' (n=' + v.samplecount + ')')
		}
	}

	self.removeTerm = term => {
		// const termfilter = self.termfilter.terms.filter(d => d.term.id != term.term.id)
		self.opts.callback({ type: 'filter_remove', termId: term.id })
	}

	self.updatePill = async function() {
		const one_term_div = select(this)
		const term = one_term_div.datum()

		const value_text = self.get_value_text(term)

		const value_btns = one_term_div.selectAll('.value_btn').data(value_text ? [{ txt: value_text }] : [], d => d.txt)

		value_btns.exit().each(self.removeValueBtn)

		value_btns
			.enter()
			.append('div')
			.attr('class', 'value_btn sja_filter_tag_btn')
			.style('display', 'inline-block')
			.style('padding', '6px 6px 3px 6px')
			.style('border-radius', '0 6px 6px 0')
			.style('background', '#4888BF')
			.style('color', 'white')
			.html(d => d.txt)
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
			//TODO
		} else if (term.bar_by_grade || term.bar_by_children) {
			//TODO
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

	self.addCategoryValues = async function(value, j) {
		// console.log('add', j)
		const term_value_btn = select(this).datum(value)
		const one_term_div = select(this.parentNode)
		const term = one_term_div.datum()

		const replace_value_select = one_term_div
			.append('select')
			.attr('class', 'value_select')
			.style('margin-right', '1px')
			.style('opacity', 0)
			.on('mouseover', () => {
				term_value_btn.style('opacity', '0.8').style('cursor', 'default')
			})
			.on('mouseout', () => {
				term_value_btn.style('opacity', '1')
			})

		// replace_value_select.selectAll('option').remove()

		self.makeSelectList(self.categoryData[term.term.id], replace_value_select, term.values, value.key, 'delete')

		replace_value_select.on('change', async () => {
			//if selected index is 0 (delete) and value is 'delete' then remove from group
			if (replace_value_select.node().selectedIndex == 0 && replace_value_select.node().value == 'delete') {
				self.removeValue({ term, j })
			} else {
				//change value of button
				const new_value = self.categoryData[term.term.id].lst.find(j => j.key == replace_value_select.node().value)
				term_value_btn.style('padding', '3px 4px 3px 4px').text('Loading...')
				replace_value_select.style('width', term_value_btn.node().offsetWidth + 'px')
				const value = { key: new_value.key, label: new_value.label }
				self.changeValue({ term, value, j })
			}
		})

		term_value_btn
			.style('padding', '3px 4px 2px 4px')
			.style('margin-right', '1px')
			.style('font-size', '1em')
			.style('position', 'absolute')
			.style('background-color', '#4888BF')
			.html(d => d.label + ' &#9662;')
			.style('opacity', 0)
			.transition()
			.duration(200)
			.style('opacity', 1)

		// 'OR' button in between values
		one_term_div
			.append('div')
			.attr('class', 'or_btn')
			.style('display', 'none')
			.style('color', '#fff')
			.style('background-color', '#4888BF')
			.style('margin-right', '1px')
			.style('padding', '8px 6px 4px 6px')
			.style('font-size', '.7em')
			.style('text-transform', 'uppercase')
			.text('or')

		//show or hide OR button
		select(one_term_div.selectAll('.or_btn')._groups[0][j]).style(
			'display',
			j > 0 && j < term.values.length - 1 ? 'inline-block' : 'none'
		)

		if (j == term.values.length - 1 && self.categoryData[term.term.id].lst.length > 2) {
			one_term_div.selectAll('.add_value_btn').remove()
			one_term_div.selectAll('.add_value_select').remove()
			await self.makePlusBtn(one_term_div, self.categoryData[term.term.id], term.values, new_value => {
				self.addValue({ term, new_value })
			})
		}

		// limit dropdown menu width to width of term_value_btn (to avoid overflow)
		// set it after editing OR button to confirm 1px margin between value_btn and + btn
		replace_value_select.style('width', term_value_btn.node().offsetWidth + 'px')
	}

	self.updateCatValue = function(d, j) {
		// console.log('update', j)
		const one_term_div = select(this.parentNode)
		const term = one_term_div.datum()

		const value_btn = select(this)
			.datum(d)
			.style('padding', '3px 4px 2px 4px')
			.html(d => d.label + ' &#9662;')
			.style('opacity', 0)
			.transition()
			.duration(200)
			.style('opacity', 1)

		const value_selects = select(one_term_div.selectAll('.value_select')._groups[0][j]).style(
			'width',
			value_btn.node().offsetWidth + 'px'
		)

		//update dropdown list for each term and '+' btn
		self.updateSelect(value_selects, term.values, d.key)

		const add_value_select = one_term_div.selectAll('.add_value_select')
		self.updateSelect(add_value_select, term.values, 'add')

		//show or hide OR button
		select(one_term_div.selectAll('.or_btn')._groups[0][j]).style(
			'display',
			j < term.values.length - 1 ? 'inline-block' : 'none'
		)
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

	self.makePlusBtn = async function(holder, data, selected_values, callback) {
		// If 2 or less values for the term then remove plus button
		if (data.lst.length <= 2) return
		const term = holder.data()

		const [add_value_select, add_value_btn] = dom.make_select_btn_pair(holder)
		add_value_select.attr('class', 'add_value_select').style('margin-right', '1px')

		add_value_select.selectAll('option').remove()

		self.makeSelectList(data, add_value_select, selected_values, false, 'add')

		//for numerical term, add option to add another bin
		if (data.lst[0].range) {
			add_value_select
				.append('option')
				.attr('value', 'add_bin')
				.text('Add new range')
		}

		//disable categories already selected
		const options = add_value_select.selectAll('option')

		options.nodes().forEach(function(d) {
			for (const [i, value] of selected_values.entries()) {
				if (value.key && value.key == d.value) d.disabled = true
				if (value.value != undefined && value.label == d.value) d.disabled = true
			}
		})

		if (data.lst) add_value_select.node().value = 'add'

		add_value_select.on('change', async () => {
			if (add_value_select.node().value == 'add_bin') {
				const range_temp = { start: '', stop: '' }
				self.editNumericBin(add_value_btn, range_temp, range => {
					self.addValue({ term, new_value: range })
				})
			} else {
				//change value of button
				const new_value = data.lst.find(j => j.key == add_value_select.node().value)
				// if (new_value.range) selected_values.push(new_value.range)
				callback(new_value)
			}
		})

		// '+' button at end of all values to add to list of values
		add_value_btn
			.attr('class', 'sja_filter_tag_btn add_value_btn')
			.style('padding', '3px 4px 3px 4px')
			.style('margin-right', '1px')
			.style('font-size', '1em')
			.style('background-color', '#4888BF')
			.style('width', '10px')
			.html('&#43;')

		// limit dropdown menu width to width of term_value_btn (to avoid overflow)
		add_value_select.style('width', add_value_btn.node().offsetWidth + 'px')
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
					self.opts.callback({
						type: 'filter_replace',
						term: tvslst[0]
					})
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
