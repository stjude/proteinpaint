import * as rx from '../rx.core'
import { select, event } from 'd3-selection'
import { dofetch2, Menu } from '../client'
import * as dom from '../dom'
import { appInit } from './app'

class TdbFilter {
	constructor(app, opts) {
		this.api = rx.getComponentApi(this)
		this.app = app
		this.dom = { holder: opts.holder, tip: new Menu({ padding: '5px' }) }
		this.durations = { exit: 500 }

		setRenderers(this)
		setInteractivity(this)

		this.categoryData = {}
		this.initHolder()
		this.bus = new rx.Bus('filter', ['postInit', 'postRender'], app.opts.callbacks, this.api)
		this.main()
		this.bus.emit('postInit')
	}

	reactsTo(action, acty) {
		if (acty[0] == 'filter') return true
	}

	main(action) {
		const terms_div = this.dom.holder.selectAll('.terms_div')
		const filters = terms_div.selectAll('.tvs_pill').data(this.app.state().termfilter.terms)

		filters.exit().each(this.exitFilter)
		filters.each(this.updateFilter)
		filters
			.enter()
			.append('div')
			.attr('class', 'tvs_pill')
			.style('white-space', 'nowrap')
			.style('display', 'inline-block')
			.style('padding', '2px')
			.transition()
			.duration(200)
			.each(this.addFilter)

		// when there are filters to be removed, must account for the delayed
		// removal after opacity transition, as btn count will decrease only
		// after the transition and remove() is done
		this.bus.emit('postRender', null, filters.exit().size() ? this.durations.exit + 100 : 0)
	}

	async getCategories(term, lst) {
		const obj = this.app.state()
		let tvslst_filter_str = false

		if (obj.tvslst_filter) {
			tvslst_filter_str = encodeURIComponent(JSON.stringify(to_parameter(obj.tvslst_filter)))
		}

		const args = [
			'genome=' +
				obj.genome +
				'&dslabel=' +
				obj.dslabel +
				'&getcategories=1&tid=' +
				term.term.id +
				'&tvslst=' +
				tvslst_filter_str
		]
		if (lst) args.push(...lst)

		let data
		try {
			data = await dofetch2('/termdb?' + args.join('&'), {}, obj.fetchOpts)
			if (data.error) throw data.error
		} catch (e) {
			window.alert(e.message || e)
		}
		return data
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
		div
			.append('div')
			.attr('class', 'terms_div')
			.style('display', 'inline-block')

		// add new term
		div
			.append('div')
			.attr('class', 'sja_filter_tag_btn add_term_btn')
			.style('padding', '4px 6px 2px 6px')
			.style('display', 'inline-block')
			.style('margin-left', '7px')
			.style('border-radius', '6px')
			.style('background-color', '#4888BF')
			.html('&#43;')
			.on('click', self.displayTreeMenu)
	}

	self.addFilter = async function(term) {
		const one_term_div = select(this)

		const term_name_btn = one_term_div
			.append('div')
			.attr('class', 'sja_filter_tag_btn term_name_btn')
			.style('border-radius', '6px 0 0 6px')
			.style('background-color', '#4888BF')
			.style('padding', '8px 6px 4px 6px')
			.style('margin-left', '5px')
			.style('font-size', '.7em')
			.text(d => d.term.name)
			.style('text-transform', 'uppercase')
			.on('click', self.displayTreeMenu)

		self.addRelationBtn(term, one_term_div)

		//value btns for each term type
		const valueAdderFxn = term.term.iscategorical
			? self.addCategoryValues
			: term.term.isfloat || term.term.isinteger
			? self.addNumericValues
			: await self.addConditionValues

		const valueData = term.term.iscategorical
			? term.values
			: term.term.isfloat || term.term.isinteger
			? term.ranges
			: term.grade_and_child

		// query db for list of categories and count
		self.categoryData[term.term.id] = await self.getCategories(term)

		one_term_div
			.selectAll('.value_btn')
			.data(valueData)
			.enter()
			.append('div')
			.attr('class', 'value_btn sja_filter_tag_btn')
			.each(valueAdderFxn)

		// button with 'x' to remove term2
		one_term_div.selectAll('.term_remove_btn').remove()
		one_term_div
			.append('div')
			.attr('class', 'sja_filter_tag_btn term_remove_btn')
			.style('padding', '4px 6px 2px 4px')
			.style('border-radius', '0 6px 6px 0')
			.style('background-color', '#4888BF')
			.html('&#215;')
			.on('click', self.removeFilter)
	}

	//term-value relation button
	self.addRelationBtn = function(term, one_term_div) {
		if (term.term.iscategorical) {
			const [condition_select, condition_btn] = dom.make_select_btn_pair(one_term_div)

			condition_select
				.append('option')
				.attr('value', 'is')
				.text('IS')

			condition_select
				.append('option')
				.attr('value', 'is_not')
				.text('IS NOT')

			condition_select.node().value = term.isnot ? 'is_not' : 'is'

			condition_select.classed('condition_select', true).on('change', self.filterNegate)

			condition_btn
				.attr('class', 'sja_filter_tag_btn condition_btn')
				.style('font-size', '.7em')
				.style('padding', '7px 6px 5px 6px')
				.text(d => (d.isnot ? 'IS NOT' : 'IS'))
				.style('background-color', d => (d.isnot ? '#511e78' : '#015051'))

			// limit dropdown menu width to width of btn (to avoid overflow)
			condition_select.style('width', condition_btn.node().offsetWidth + 'px')
		} else {
			const condition_btn = one_term_div
				.append('div')
				.attr('class', 'sja_filter_tag_btn condition_btn')
				.style('font-size', '.7em')
				.style('background-color', '#015051')
				.style('pointer-events', 'none')
				.style('padding', '8px 6px 4px 6px')
				.text('IS')
		}
	}

	self.updateFilter = async function(term) {
		const one_term_div = select(this).datum(term)

		one_term_div.selectAll('.term_name_btn').text(term.term.name)

		//term-value relation button
		const condition_select = one_term_div.selectAll('.condition_select')
		condition_select.node().value = term.isnot ? 'is_not' : 'is'

		const condition_btn = one_term_div
			.selectAll('.condition_btn')
			.text(term.isnot ? 'IS NOT' : 'IS')
			.style('background-color', term.isnot ? '#511e78' : '#015051')

		one_term_div.selectAll('.condition_select').style('width', condition_btn.node().offsetWidth + 'px')

		const data = await self.getCategories(term)
		self.categoryData[term.term.id] = data

		const value_btns = one_term_div.selectAll('.value_btn').data(term.values)

		value_btns.exit().each(self.removeValueBtn)

		value_btns
			.transition()
			.duration(200)
			.each(self.updateValueBtn)

		const valueAdderFxn = term.term.iscategorical
			? self.addCategoryValues
			: term.term.isfloat || term.term.isinteger
			? self.addNumericValues
			: await self.addConditionValues

		value_btns
			.enter()
			.append('div')
			.attr('class', 'value_btn sja_filter_tag_btn')
			.style('margin-right', '1px')
			.style('position', 'absolute')
			.each(valueAdderFxn)

		// button with 'x' to remove term2
		one_term_div.selectAll('.term_remove_btn').remove()
		one_term_div
			.append('div')
			.attr('class', 'sja_filter_tag_btn term_remove_btn')
			.style('margin-left', '1px')
			.style('padding', '4px 6px 2px 4px')
			.style('border-radius', '0 6px 6px 0')
			.style('background-color', '#4888BF')
			.html('&#215;')
			.on('click', self.removeFilter)
	}

	self.exitFilter = async function(term) {
		select(this)
			.style('opacity', 1)
			.transition()
			.duration(self.durations.exit)
			.style('opacity', 0)
			.remove()
	}

	self.addCategoryValues = async function(value, j) {
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

		if (j == term.values.length - 1) {
			one_term_div.selectAll('.add_value_btn').remove()
			one_term_div.selectAll('.add_value_select').remove()
			await self.makePlusBtn(one_term_div, self.categoryData[term.term.id], term.values, new_value => {
				self.addValue({ term, new_value })
			})
		}

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

		// limit dropdown menu width to width of term_value_btn (to avoid overflow)
		// set it after editing OR button to confirm 1px margin between value_btn and + btn
		replace_value_select.style('width', term_value_btn.node().offsetWidth + 'px')
	}

	self.addNumericValues = function(range, j) {
		const value_btn = select(this).datum(range)
		const one_term_div = select(this.parentNode)
		const term = one_term_div.datum()

		const unannotated_cats = { lst: [] }

		for (const [index, cat] of self.categoryData[term.term.id].lst.entries()) {
			if (cat.range.value != undefined) {
				unannotated_cats.lst.push(cat)
			}
		}

		if (range.value != undefined) {
			// const [numeric_select, value_btn] = dom.make_select_btn_pair(one_term_div)
			const numeric_select = one_term_div
				.append('select')
				.attr('class', 'value_select')
				.style('margin-right', '1px')
				.style('opacity', 0)
				.on('mouseover', () => {
					value_btn.style('opacity', '0.8').style('cursor', 'default')
				})
				.on('mouseout', () => {
					value_btn.style('opacity', '1')
				})

			numeric_select.style('margin-right', '1px')

			self.makeSelectList(unannotated_cats, numeric_select, term, null, 'delete')

			value_btn
				.style('position', 'absolute')
				.style('padding', '3px 4px 3px 4px')
				.style('margin-right', '1px')
				.style('font-size', '1em')
				.style('background-color', '#4888BF')
				.html(range.label)

			numeric_select.node().value = range.label

			numeric_select.style('width', value_btn.node().offsetWidth + 'px')

			// change categroy from dropdown
			numeric_select.on('change', async () => {
				//if value is 'delete' then remove from group
				if (numeric_select.node().value == 'delete') {
					term.ranges.splice(j, 1)
					if (term.ranges.length == 0) {
						obj.group.terms.splice(i, 1)
					}
				} else {
					//change value of button
					const new_value = data.lst.find(j => j.label == numeric_select.node().value)

					value_btn.style('padding', '3px 4px 3px 4px').text('Loading...')

					numeric_select.style('width', value_btn.node().offsetWidth + 'px')

					obj.group.terms[i].ranges[j] = new_value.range
				}

				//update gorup and load tk
				// await obj.callback()
			})
		} else {
			value_btn
				.style('font-size', '1em')
				.style('padding', '4px 5px 2px 5px')
				.style('margin-right', '1px')
				.style('background-color', '#4888BF')

			value_btn.html(self.setRangeBtnText(range))

			value_btn.on('click', () => {
				self.editNumericBin(value_btn, range, range => {
					value_btn.html(self.setRangeBtnText(range))
				})
			})
		}

		// 'OR' button in between values
		one_term_div
			.append('div')
			.attr('class', 'or_btn')
			.style('display', 'none')
			.style('color', '#fff')
			.style('background-color', '#4888BF')
			.style('margin-right', '1px')
			.style('padding', '7px 6px 5px 6px')
			.style('font-size', '.7em')
			.style('text-transform', 'uppercase')
			.text('or')

		if (j == term.ranges.length - 1) {
			self.makePlusBtn(one_term_div, unannotated_cats, term.ranges)
		}
	}

	self.updateValueBtn = function(d, j) {
		const one_term_div = select(this.parentNode)
		const term = one_term_div.datum()

		// console.log('update', j)
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

		// console.log('exit',j)
		select(one_term_div.selectAll('.value_select')._groups[0][j]).remove()
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
			if (selected_values.find(v => (v.key || v.label) == d.value) && d.value != btn_value) {
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
					selected_values.push(range)
				})
			} else {
				//change value of button
				const new_value = data.lst.find(j => j.key == add_value_select.node().value)
				if (new_value.range) selected_values.push(new_value.range)
				else callback(new_value)
			}
		})

		// '+' button at end of all values to add to list of values
		add_value_btn
			.attr('class', 'sja_filter_tag_btn add_value_btn')
			.style('padding', '3px 4px 3px 4px')
			.style('margin-right', '1px')
			.style('font-size', '1em')
			.style('background-color', '#4888BF')
			.html('&#43;')

		// limit dropdown menu width to width of term_value_btn (to avoid overflow)
		add_value_select.style('width', add_value_btn.node().offsetWidth + 'px')
	}

	self.setRangeBtnText = function(range) {
		const x = "<span style='font-family:Times;font-style:italic'>x</span>"
		let range_text
		if (range.startunbounded) {
			range_text = x + ' ' + (range.stopinclusive ? '&le;' : '&lt;') + ' ' + range.stop
		} else if (range.stopunbounded) {
			range_text = x + ' ' + (range.startinclusive ? '&ge;' : '&gt;') + ' ' + range.start
		} else {
			range_text =
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
		return range_text
	}
}

function setInteractivity(self) {
	self.displayTreeMenu = async function(term) {
		const one_term_div = this
		const obj = self.app.state()
		self.dom.tip.clear().showunder(one_term_div)
		const treediv = self.dom.tip.d.append('div')
		// set termfilter terms to all filter-terms if '+' or all except current term if 'term_name_btn'
		const terms = select(one_term_div).classed('add_term_btn')
			? obj.termfilter.terms
			: obj.termfilter.terms.filter(t => t.id != term.termId)

		// a new object as init() argument for launching the tree with modifiers
		const tree_obj = {
			state: {
				dslabel: obj.dslabel,
				genome: obj.genome,
				termfilter: {
					show_top_ui: false,
					terms: terms
				}
			},
			callbacks: {
				app: { 'postInit.test': () => {} }
			}
		}
		appInit(tree_obj, treediv)
	}

	self.editNumericBin = function(holder, range, callback) {
		self.dom.tip.clear()

		const equation_div = self.dom.tip.d
			.append('div')
			.style('display', 'block')
			.style('padding', '3px 5px')

		const start_input = equation_div
			.append('input')
			.attr('type', 'number')
			.attr('value', range.start)
			.style('width', '60px')
			.on('keyup', async () => {
				if (!client.keyupEnter()) return
				start_input.property('disabled', true)
				await apply()
				start_input.property('disabled', false)
			})

		// to replace operator_start_div
		const startselect = equation_div.append('select').style('margin-left', '10px')

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
		const stopselect = equation_div.append('select').style('margin-right', '10px')

		stopselect.append('option').html('&le;')
		stopselect.append('option').html('&lt;')
		stopselect.append('option').html('&#8734;')

		stopselect.node().selectedIndex = range.stopunbounded ? 2 : range.stopinclusive ? 0 : 1

		const stop_input = equation_div
			.append('input')
			.attr('type', 'number')
			.style('width', '60px')
			.attr('value', range.stop)
			.on('keyup', async () => {
				if (!client.keyupEnter()) return
				stop_input.property('disabled', true)
				await apply()
				stop_input.property('disabled', false)
			})

		self.dom.tip.d
			.append('div')
			.attr('class', 'sja_menuoption')
			.style('text-align', 'center')
			.text('APPLY')
			.on('click', () => {
				self.dom.tip.hide()
				apply()
			})

		// tricky: only show tip when contents are filled, so that it's able to detect its dimention and auto position itself
		self.dom.tip.showunder(holder.node())

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
				// display_numeric_filter(group, term_index, value_div)
				self.dom.tip.hide()
				await obj.callback()
				if (callback) callback(range)
			} catch (e) {
				window.alert(e)
			}
		}
	}

	self.removeFilter = term => self.app.dispatch({ type: 'filter_remove', termId: term.id })

	self.filterNegate = term => self.app.dispatch({ type: 'filter_negate', termId: term.id })

	self.addValue = opts => self.app.dispatch({ type: 'filter_value_add', termId: opts.term.id, value: opts.new_value })

	self.changeValue = opts =>
		self.app.dispatch({ type: 'filter_value_change', termId: opts.term.id, value: opts.value, valueId: opts.j })

	self.removeValue = opts => self.app.dispatch({ type: 'filter_value_remove', termId: opts.term.id, valueId: opts.j })

	/*
	self.removeValue = //if selected index is 0 (delete) and value is 'delete' then remove from group
						if (replace_value_select.node().selectedIndex == 0 && replace_value_select.node().value == 'delete') {
							self.removeValue({term,j})
						} else {
							//change value of button
							const new_value = data.lst.find(j => j.key == replace_value_select.node().value)
							term_value_btn.style('padding', '3px 4px 3px 4px').text('Loading...')
							replace_value_select.style('width', term_value_btn.node().offsetWidth + 'px')
							const value = { key: new_value.key, label: new_value.label }
							self.changeValue({term, value, j})
						}
	*/
}
