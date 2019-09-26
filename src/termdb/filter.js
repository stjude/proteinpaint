import * as rx from "../rx.core"
import {select, event} from "d3-selection"
import {dofetch2} from "../client"
import {plotInit} from "./plot"
import * as dom from "../dom"

class TdbFilter {
	constructor(app, opts) {
		this.api = rx.getComponentApi(this)
		this.app = app
		this.dom = {holder: opts.holder}
		// set closure methods to handle conflicting "this" contexts
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
			.style("white-space", "nowrap")
			.style("display", "inline-block")
			.style("padding", "2px")
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
			.style("display", "block")
			.style("border", "solid 1px #ddd")

		div.append("div")
			.style("display", "inline-block")
			.style('text-transform', 'uppercase')
			.style('color','#bbb')
			.style('margin-right','10px')
			.html('Filter')

		// div to display all tvs bluepills	
		div.append("div").attr("class", "terms_div")
			.style("display", "inline-block")

		// add new term
		div.append("div")
			.attr("class", "sja_filter_tag_btn add_term_btn")
			.style("padding", "4px 6px 2px 6px")
			.style("display", "inline-block")
			.style("margin-left", "7px")
			.style("border-radius", "6px")
			.style("background-color", "#4888BF")
			.html("&#43;")
	}

	addFilter(term, div){
		const one_term_div = div.datum(term)

		const term_name_btn = one_term_div
			.append("div")
			.attr("class", "sja_filter_tag_btn term_name_btn")
			.style("border-radius", "6px 0 0 6px")
			.style("background-color", "#4888BF")
			.style("padding", "8px 6px 4px 6px")
			.style("margin-left", "5px")
			.style("font-size", ".7em")
			.text(d => d.term.name)
			.style("text-transform", "uppercase")

		//term-value relation button
		if (term.term.iscategorical) {
			const [condition_select, condition_btn] = dom.make_select_btn_pair(one_term_div)

			condition_select
				.attr('class','condition_select')
				.append("option")
				.attr("value", "is")
				.text("IS")

			condition_select
				.append("option")
				.attr("value", "is_not")
				.text("IS NOT")

			condition_select.node().value = term.isnot ? "is_not" : "is"

			condition_select.on("change", async () => {
				//change value of button
				term.isnot = term.isnot ? false : true

				//update gorup and load tk
				await obj.callback()
			})

			condition_btn
				.attr("class", "sja_filter_tag_btn condition_btn")
				.style("font-size", ".7em")
				.style("padding", "7px 6px 5px 6px")
				.text(d => d.isnot ? "IS NOT" : "IS")
				.style("background-color", d => d.isnot ? "#511e78" : "#015051")

			// limit dropdown menu width to width of btn (to avoid overflow)
			condition_select.style("width", condition_btn.node().offsetWidth + "px")
		} else {
			const condition_btn = one_term_div
				.append("div")
				.attr("class", "sja_filter_tag_btn condition_btn")
				.style("background-color", "#eeeeee")
				.style("font-size", ".7em")
				.style("padding", "7px 6px 5px 6px")

			condition_btn
				.text("IS")
				.style("background-color", "#015051")
				.style("pointer-events", "none")
		}

		//value btns for each term type
		if (term.term.iscategorical) {
			// query db for list of categories and count
			// const data = await getcategories(term)

			one_term_div
				.selectAll(".value_btn")
				.data(term.values)
				.enter()
				.append('div')
				.attr('class','value_btn sja_filter_tag_btn')
				// .style('position','absolute')
				.each(function(value,j){

					const term_value_btn = select(this).datum(value)
						.style("padding", "3px 4px 2px 4px")
						.style("margin-right", "1px")
						.style("font-size", "1em")
						.style("background-color", "#4888BF")
						.html(d => d.label + " &#9662;")

					// 'OR' button in between values
					one_term_div
						.append("div")
						.attr('class','or_btn')
						.style("display", "none")
						.style("color", "#fff")
						.style("background-color", "#4888BF")
						.style("margin-right", "1px")
						.style("padding", "7px 6px 5px 6px")
						.style("font-size", ".7em")
						.style("text-transform", "uppercase")
						.text("or")
				})
		}

		// button with 'x' to remove term2
		one_term_div.selectAll('.term_remove_btn').remove()
		one_term_div
			.append("div")
			.attr("class", "sja_filter_tag_btn term_remove_btn")
			.style("padding", "4px 6px 2px 4px")
			.style("border-radius", "0 6px 6px 0")
			.style("background-color", "#4888BF")
			.html("&#215;")
	}

	updateFilter(filter, div){
		
	}

	removeFilter(filter, div){
		
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
