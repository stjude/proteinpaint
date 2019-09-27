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
		this.yesThis()
        this.notThis(this)
		this.render()
		this.main()

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

		filters.exit().each(this._exitFilter)
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

			condition_select
			.classed("condition_select", true)
			.on('change',this.filterNegate)

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
			const data = await _this.getCategories(term)

			one_term_div.selectAll('.value_btn')
				.data(term.values)
				.enter()
				.append('div')
				.attr('class','value_btn sja_filter_tag_btn')
				.style('position','absolute')
				// .each(this._addCatValue)
				.each(async function(value,j){

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
							_this.removeValue({term,j})
						} else {
							//change value of button
							const new_value = data.lst.find(j => j.key == replace_value_select.node().value)
							term_value_btn.style('padding', '3px 4px 3px 4px').text('Loading...')
							replace_value_select.style('width', term_value_btn.node().offsetWidth + 'px')
							const value = { key: new_value.key, label: new_value.label }
							_this.changeValue({term, value, j})
						}
					})
			
					term_value_btn
						.style('padding', '3px 4px 2px 4px')
						.style('margin-right', '1px')
						.style('font-size', '1em')
						.style('background-color', '#4888BF')
						.html(d => d.label + ' &#9662;')
			
					// limit dropdown menu width to width of term_value_btn (to avoid overflow)
					replace_value_select.style('width', term_value_btn.node().offsetWidth + 'px')
					
					if (j == term.values.length - 1) {
						// _this.makePlusBtn(one_term_div, data, term.values)
						await _this.makePlusBtn(one_term_div, data, term.values, (new_value)=>{
							_this.addValue({term, new_value})
						})
					}

					// 'OR' button in between values
					one_term_div
						.append('div')
						.attr('class','or_btn')
						.style('display','inline-block')
						.style('color', '#fff')
						.style('background-color', '#4888BF')
						.style('margin-right', '1px')
						.style('padding', '8px 6px 4px 6px')
						.style('font-size', '.7em')
						.style('text-transform', 'uppercase')
						.text('or')

					//show or hide OR button 
					select(one_term_div.selectAll('.or_btn')._groups[0][j])
						.style('display',j>0?'inline-block':'none')
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
			.on('click', this.removeFilter)
	}

	async updateFilter(term, div){
		
		const _this = this
		const one_term_div = div.datum(term)

		one_term_div.selectAll('.term_name_btn')
			.text(term.term.name)

		//term-value relation button
		if (term.term.iscategorical) {

			const condition_select = one_term_div.selectAll('.condition_select')
			condition_select.node().value = term.isnot ? 'is_not' : 'is'
			
			const condition_btn = one_term_div.selectAll('.condition_btn')
				.text(term.isnot ? "IS NOT" : "IS")
				.style("background-color", term.isnot ? "#511e78" : "#015051")

			one_term_div.selectAll('.condition_select').style("width", condition_btn.node().offsetWidth + "px")

			const data = await _this.getCategories(term)

			const value_btns = one_term_div
				.selectAll(".value_btn")
				.data(term.values)

			value_btns.exit()
				.each(function(d,j) {
					// console.log('exit',j)
					select(one_term_div.selectAll('.value_select')._groups[0][j]).remove()
					select(one_term_div.selectAll('.or_btn')._groups[0][j]).remove()
					select(this)
						.style('opacity',1)
						.transition()
						.duration(500)
						.style('opacity',0)
						.remove()
				})

			value_btns.transition()
				.duration(200)
				.each(function(d, j){
					// console.log('update', j)
					const value_btn = select(this).datum(d)
						.style("padding", "3px 4px 2px 4px")
						.html(d=>d.label + " &#9662;")
						.style('opacity',0)
						.transition()
						.duration(200)
						.style('opacity',1)
						

					const value_selects = select(one_term_div.selectAll('.value_select')._groups[0][j])
						.style('width',value_btn.node().offsetWidth + 'px')

					//update dropdown list for each term and '+' btn
					_this.updateSelect(value_selects, term.values, d.key)

					const add_value_select = one_term_div.selectAll('.add_value_select')
					_this.updateSelect(add_value_select, term.values, 'add')

					//show or hide OR button 
					select(one_term_div.selectAll('.or_btn')._groups[0][j])
						.style('display',j<term.values.length-1?'inline-block':'none')

				})

			value_btns.enter()
				.append('div')
				.attr('class','value_btn sja_filter_tag_btn')
				.style("margin-right", "1px")
				.style('position','absolute')
				.each(async function(value,j){
					// console.log('enter', j)
					const term_value_btn = select(this).datum(value)

					const replace_value_select = one_term_div.append('select')
						.attr('class','value_select')
						.style("margin-right", j+"px")
						.style('opacity',0)
						.on('mouseover',()=>{
							term_value_btn.style('opacity', '0.8')
							.style('cursor','default')
						})
						.on('mouseout',()=>{
							term_value_btn.style('opacity', '1')
						})
					
					_this.makeSelectList(data, replace_value_select, term.values, value.key, "delete")
			
					replace_value_select.on('change', async () => {
						//if selected index is 0 (delete) and value is 'delete' then remove from group
						if (replace_value_select.node().selectedIndex == 0 && replace_value_select.node().value == 'delete') {
							_this.removeValue({term,j})
						} else {
							//change value of button
							const new_value = data.lst.find(j => j.key == replace_value_select.node().value)
							term_value_btn.style('padding', '3px 4px 3px 4px').text('Loading...')
							replace_value_select.style('width', term_value_btn.node().offsetWidth + 'px')
							const value = { key: new_value.key, label: new_value.label }
							_this.changeValue({term, value, j})
						}
					})
			
					term_value_btn
						.style("padding", "3px 4px 2px 4px")
						.style("margin-right", "1px")
						.style("font-size", "1em")
						.style("background-color", "#4888BF")
						.html(d => d.label + " &#9662;")

					one_term_div.selectAll('.add_value_btn').remove()
					one_term_div.selectAll('.add_value_select').remove()
					await _this.makePlusBtn(one_term_div, data, term.values, (new_value)=>{
						_this.addValue({term, new_value})
					})

					// limit dropdown menu width to width of term_value_btn (to avoid overflow)
					replace_value_select.style("width", term_value_btn.node().offsetWidth + "px")

					// 'OR' button in between values
					one_term_div
						.append("div")
						.attr('class','or_btn')
						.style('display','none')
						.style("color", "#fff")
						.style("background-color", "#4888BF")
						.style("margin-right", "1px")
						.style("padding", "8px 6px 4px 6px")
						.style("font-size", ".7em")
						.style("text-transform", "uppercase")
						.text("or")

					//show or hide OR button 
					select(one_term_div.selectAll('.or_btn')._groups[0][j])
						.style('display',j<term.values.length-1?'inline-block':'none')
				})

		}
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
			.on('click', this.removeFilter)
	}

	exitFilter(term, div){
		div.style('opacity',1)
			.transition()
			.duration(500)
			.style('opacity',0)
			.remove()
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

	updateSelect(select, selected_values, btn_value){
		const options = select.selectAll("option")

		options.nodes().forEach(function(d) {
			if (selected_values.find(v => (v.key||v.label) == d.value) && d.value != btn_value) {
				d.disabled = true
			}else{
				d.disabled = false
			}
			select.node().value = btn_value
		})
	}

	async makePlusBtn(holder, data, selected_values, callback) {
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

	yesThis() {
		this.removeFilter = term => this.app.dispatch({type: 'filter_remove', termId: term.id})

		this.filterNegate = term => this.app.dispatch({type: 'filter_negate', termId: term.id})

		this.addValue = opts => this.app.dispatch({type: 'filter_value_add', termId: opts.term.id, value: opts.new_value})

		this.changeValue = opts => this.app.dispatch({type: 'filter_value_change', termId: opts.term.id, value: opts.value, valueId: opts.j})

		this.removeValue = opts => this.app.dispatch({type: 'filter_value_remove', termId: opts.term.id, valueId: opts.j})
	}

	notThis(self){
		self._addFilter = function(term) {
			self.addFilter(term, select(this))
		}
		self._updateFilter = function(term) {
			self.updateFilter(term, select(this))
		}
		self._exitFilter = function(term) {
			self.exitFilter(term, select(this))
		}
	}
}

exports.filterInit = rx.getInitFxn(TdbFilter)
