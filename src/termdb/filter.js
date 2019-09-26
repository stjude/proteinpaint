import * as rx from '../rx.core'
import {select, event} from 'd3-selection'
import {dofetch2, Menu} from '../client'
import * as dom from '../dom'
import {treeInit} from "./tree"

class TdbFilter {
	constructor(app, opts) {
		this.api = rx.getComponentApi(this)
		this.app = app
		this.dom = {holder: opts.holder, tip: new Menu({ padding: "5px" })}
		// set closure methods to handle conflicting 'this' contexts
		// this.yesThis()
        this.notThis(this)
        this.render()

		// this.components = {
		// 	plots: {}
		// }

		this.bus = new rx.Bus('filter', ['postInit', 'postNotify'], app.opts.callbacks, this.api)
		this.bus.emit('postInit')
	}

	reactsTo(action, acty) {
		if (acty[0] == 'filter') return true
	}

	main(action) {

		const terms_div = this.dom.holder.selectAll('.terms_div')
		const filters = terms_div.selectAll('.tvs_pill')
			.data(this.app.state().termfilter.terms)

		filters.exit().each(this._removeFilter)
		filters.each(this._updateFilter )
		filters.enter()
			.append('div')
			.attr('class','tvs_pill')
			.style('white-space', 'nowrap')
			.style('display', 'inline-block')
			.style('padding', '2px')
			.transition()
			.duration(200)
			.each(this._addFilter)
	}
	
	render() {
		const div = this.dom.holder
			.attr('class','filter_div')
			.style('width', 'fit-content')
			.style('padding', '5px')
			.style('margin', '10px')
			.style('margin-top', '5px')
			.style('display', 'block')
			.style('border', 'solid 1px #ddd')

		div.append('div')
			.style('display', 'inline-block')
			.style('text-transform', 'uppercase')
			.style('color','#bbb')
			.style('margin-right','10px')
			.html('Filter')

		// div to display all tvs bluepills	
		div.append('div').attr('class', 'terms_div')
			.style('display', 'inline-block')

		// add new term
		div.append('div')
			.attr('class', 'sja_filter_tag_btn add_term_btn')
			.style('padding', '4px 6px 2px 6px')
			.style('display', 'inline-block')
			.style('margin-left', '7px')
			.style('border-radius', '6px')
			.style('background-color', '#4888BF')
			.html('&#43;')
	}

	async addFilter(term, div){
		const _this = this
		const one_term_div = div.datum(term)

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
			.on("click", async () => {
				// const obj = this.app.state()
				this.dom.tip.clear().showunder(term_name_btn.node())
				const treediv = this.dom.tip.d.append("div")
	
				// a new object as init() argument for launching the tree with modifiers
				// const tree_obj = {
				// 	state: {
				// 		dslabel: obj.dslabel,
				// 		genome: obj.genome,
				// 		termfilter: {
				// 			show_top_ui: true,
				// 			terms: []
				// 		}
				// 	}
				// }
				treeInit(this.app, {holder: treediv})
			})	

		//term-value relation button
		if (term.term.iscategorical) {
			const [condition_select, condition_btn] = dom.make_select_btn_pair(one_term_div)

			condition_select
				.attr('class','condition_select')
				.append('option')
				.attr('value', 'is')
				.text('IS')

			condition_select
				.append('option')
				.attr('value', 'is_not')
				.text('IS NOT')

			condition_select.node().value = term.isnot ? 'is_not' : 'is'

			condition_select.on('change', async () => {
				//change value of button
				term.isnot = term.isnot ? false : true

				//update gorup and load tk
				await obj.callback()
			})

			condition_btn
				.attr('class', 'sja_filter_tag_btn condition_btn')
				.style('font-size', '.7em')
				.style('padding', '7px 6px 5px 6px')
				.text(d => d.isnot ? 'IS NOT' : 'IS')
				.style('background-color', d => d.isnot ? '#511e78' : '#015051')

			// limit dropdown menu width to width of btn (to avoid overflow)
			condition_select.style('width', condition_btn.node().offsetWidth + 'px')
		} else {
			const condition_btn = one_term_div
				.append('div')
				.attr('class', 'sja_filter_tag_btn condition_btn')
				.style('background-color', '#eeeeee')
				.style('font-size', '.7em')
				.style('padding', '7px 6px 5px 6px')

			condition_btn
				.text('IS')
				.style('background-color', '#015051')
				.style('pointer-events', 'none')
		}

		//value btns for each term type
		if (term.term.iscategorical) {
			// query db for list of categories and count
			const data = await _this.getcategories(term)

			one_term_div
				.selectAll('.value_btn')
				.data(term.values)
				.enter()
				.append('div')
				.attr('class','value_btn sja_filter_tag_btn')
				.style('position','absolute')
				// .each(this._addCatValue)
				.each(function(value,j){

					const term_value_btn = select(this).datum(value)

					const replace_value_select = one_term_div.append('select')
						.attr('class','value_select')
						.style('margin-right', '1px')
						.style('opacity',0)
						.on('mouseover',()=>{
							term_value_btn.style('opacity', '0.8')
							.style('cursor','default')
						})
						.on('mouseout',()=>{
							term_value_btn.style('opacity', '1')
						})

					// replace_value_select.selectAll('option').remove()
					
					_this.makeSelectList(data, replace_value_select, term.values, value.key, 'delete')
			
					replace_value_select.on('change', async () => {
						//if selected index is 0 (delete) and value is 'delete' then remove from group
						if (replace_value_select.node().selectedIndex == 0 && replace_value_select.node().value == 'delete') {
							term.values.splice(j, 1)
							if (term.values.length == 0) {
								obj.group.terms.splice(i, 1)
							}
						} else {
							//change value of button
							const new_value = data.lst.find(j => j.key == replace_value_select.node().value)
							term_value_btn.style('padding', '3px 4px 3px 4px').text('Loading...')
							term.values[j] = { key: new_value.key, label: new_value.label }
							replace_value_select.style('width', term_value_btn.node().offsetWidth + 'px')
						}
			
						//update gorup and load tk
						await obj.callback()
					})
			
					term_value_btn
						.style('padding', '3px 4px 2px 4px')
						.style('margin-right', '1px')
						.style('font-size', '1em')
						.style('background-color', '#4888BF')
						.html(d => d.label + ' &#9662;')
			
					// limit dropdown menu width to width of term_value_btn (to avoid overflow)
					replace_value_select.style('width', term_value_btn.node().offsetWidth + 'px')

					// 'OR' button in between values
					one_term_div
						.append('div')
						.attr('class','or_btn')
						.style('display', 'none')
						.style('color', '#fff')
						.style('background-color', '#4888BF')
						.style('margin-right', '1px')
						.style('padding', '7px 6px 5px 6px')
						.style('font-size', '.7em')
						.style('text-transform', 'uppercase')
						.text('or')

					if (j == term.values.length - 1) {
						_this.make_plus_btn(one_term_div, data, term.values)
					}
				})
		}

		// button with 'x' to remove term2
		one_term_div.selectAll('.term_remove_btn').remove()
		one_term_div
			.append('div')
			.attr('class', 'sja_filter_tag_btn term_remove_btn')
			.style('padding', '4px 6px 2px 4px')
			.style('border-radius', '0 6px 6px 0')
			.style('background-color', '#4888BF')
			.html('&#215;')
	}

	updateFilter(filter, div){
		
	}

	removeFilter(filter, div){
		
	}

	async getcategories(term, lst) {
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
			data = await dofetch2('/termdb?' + args.join('&'), {}, obj.do_query_opts)
			if (data.error) throw data.error
		} catch (e) {
			window.alert(e.message || e)
		}
		return data
	}

	makeSelectList(data, select, selected_values, btn_value, first_option) {
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
			select.append('option').text('ERROR: Can\'t get the data')
		}
	}

	make_plus_btn(holder, data, selected_values) {
		// If 2 or less values for the term then remove plus button
		if (data.lst.length <= 2) return

		const [add_value_select, add_value_btn] = dom.make_select_btn_pair(holder)
		add_value_select
			.attr('class', 'add_value_select')
			.style('margin-right', '1px')

		add_value_select.selectAll('option').remove()

		this.makeSelectList(data, add_value_select, selected_values, false, 'add')

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
				edit_numeric_bin(add_value_btn, range_temp, range => {
					selected_values.push(range)
				})
			} else {
				//change value of button
				const new_value = data.lst.find(j => j.key == add_value_select.node().value)
				if (new_value.range) selected_values.push(new_value.range)
				else selected_values.push({ key: new_value.key, label: new_value.label })

				//update gorup and load tk
				await obj.callback()
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

	notThis(self){
		self._addFilter = function(term) {
			self.addFilter(term, select(this))
		}
		self._updateFilter = function(filter) {
			self.updateFilter(filter, select(this))
		}
		self._removeFilter = function(filter) {
			self.removeFilter(filter, select(this))
		}
	}
}

exports.filterInit = rx.getInitFxn(TdbFilter)
