import * as client from "./client"
import * as dom from "./dom"
import { init } from "./mds.termdb"
import { event as d3event } from "d3-selection"

/*
********************** EXPORTED
display
to_parameter
********************** INTERNAL
*/

export async function display(obj) {
	/*
group{}
	.terms[]
		.term{}
		.values[]
		.range{}
		.iscategorical
		.isinteger
		.isfloat
		.isnot
*/

	const terms_div = obj.group_div.append("div").style("display", "inline-block")

	obj.tvstip = new client.Menu({ padding: "5px" })

	update_terms()

	obj.update_terms = update_terms

	// add new term
	const add_term_btn = obj.group_div
		.append("div")
		.attr("class", "sja_filter_tag_btn add_term_btn")
		.style("padding", "2px 7px")
		.style("display", "inline-block")
		.style("margin-left", "7px")
		.style("border-radius", "6px")
		.style("background-color", "#4888BF")
		.html("&#43;")
		.on("click", async () => {
			obj.tvstip.clear().showunder(add_term_btn.node())

			const treediv = obj.tvstip.d.append("div")

			// a new object as init() argument for launching the tree with modifiers
			const tree_obj = {
				genome: obj.genome,
				mds: obj.mds,
				div: treediv,
				default_rootterm: {},
				termfilter: { terms: obj.tvslst_filter },
				modifier_barchart_selectbar: {
					callback: result => {
						obj.tvstip.hide()
						add_term(result)
					}
				}
			}
			init(tree_obj)
		})

	// all private functions below

	async function update_terms() {
		terms_div.selectAll("*").remove()

		for (const [i, term] of obj.group.terms.entries()) {
			const one_term_div = terms_div
				.append("div")
				.style("white-space", "nowrap")
				.style("display", "inline-block")
				.style("padding", "2px")

			const term_name_btn = one_term_div
				.append("div")
				.attr("class", "sja_filter_tag_btn term_name_btn")
				.style("border-radius", "6px 0 0 6px")
				.style("background-color", "#4888BF")
				.style("padding", "7px 6px 5px 6px")
				.style("margin-left", "5px")
				.style("font-size", ".7em")
				.text(term.term.name)
				.style("text-transform", "uppercase")
				.on("click", async () => {
					obj.tvstip.clear().showunder(term_name_btn.node())

					const treediv = obj.tvstip.d.append("div")

					// a new object as init() argument for launching the tree with modifiers
					const tree_obj = {
						genome: obj.genome,
						mds: obj.mds,
						div: treediv,
						default_rootterm: {},
						termfilter: { terms: obj.tvslst_filter },
						modifier_barchart_selectbar: {
							callback: result => {
								obj.tvstip.hide()
								replace_term(result, i)
								obj.callback()
							}
						}
					}
					init(tree_obj)
				})

			//term-value relation button
			if (term.term.iscategorical) {
				const [condition_select, condition_btn] = dom.make_select_btn_pair(one_term_div)

				condition_select
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
					obj.group.terms[i].isnot = term.isnot ? false : true

					//update gorup and load tk
					await obj.callback()
				})

				condition_btn
					.attr("class", "sja_filter_tag_btn condition_btn")
					.style("font-size", ".7em")
					.style("padding", "7px 6px 5px 6px")
					.text(term.isnot ? "IS NOT" : "IS")
					.style("background-color", term.isnot ? "#511e78" : "#015051")

				// limit dropdown menu width to width of btn (to avoid overflow)
				condition_select.style("width", condition_btn.node().offsetWidth + "px")
			} else {
				const condition_btn = one_term_div
					.append("div")
					.attr("class", "sja_filter_tag_btn condition_btn")
					.style("background-color", "#eeeeee")
					.style("font-size", ".7em")
					.style("padding", "7px 6px 5px 6px")

				if (term.term.isinteger || term.term.isfloat) {
					// range label is not clickable
					condition_btn
						.text("IS")
						.style("background-color", "#015051")
						.style("pointer-events", "none")
				} else if (term.term.iscondition) {
					condition_btn
						.text("IS")
						.style("background-color", "#015051")
						.style("pointer-events", "none")
				}
			}

			const term_value_div = one_term_div.append("div").style("display", "inline-block")

			if (term.term.iscategorical) {
				// query db for list of categories and count
				const data = await getcategories(term)

				for (let j = 0; j < term.values.length; j++) {
					const [replace_value_select, term_value_btn] = dom.make_select_btn_pair(one_term_div)
					replace_value_select.style("margin-right", "1px")
					replace_value_select.selectAll("option").remove()

					make_select_list(data, replace_value_select, term.values, term.values[j].key, "delete")

					replace_value_select.on("change", async () => {
						//if selected index is 0 (delete) and value is 'delete' then remove from group
						if (replace_value_select.node().selectedIndex == 0 && replace_value_select.node().value == "delete") {
							obj.group.terms[i].values.splice(j, 1)
							if (obj.group.terms[i].values.length == 0) {
								obj.group.terms.splice(i, 1)
							}
						} else {
							//change value of button
							const new_value = data.lst.find(j => j.key == replace_value_select.node().value)
							term_value_btn.style("padding", "3px 4px 3px 4px").text("Loading...")
							obj.group.terms[i].values[j] = { key: new_value.key, label: new_value.label }
						}

						//update gorup and load tk
						await obj.callback()
					})

					term_value_btn
						.attr("class", "sja_filter_tag_btn value_btn")
						.style("padding", "2px 4px 3px 4px")
						.style("margin-right", "1px")
						.style("font-size", "1em")
						.style("background-color", "#4888BF")
						.html(term.values[j].label + " &#9662;")

					// limit dropdown menu width to width of term_value_btn (to avoid overflow)
					replace_value_select.style("width", term_value_btn.node().offsetWidth + "px")

					// 'OR' button in between values
					if (j < term.values.length - 1) {
						one_term_div
							.append("div")
							.style("display", "inline-block")
							.style("color", "#fff")
							.style("background-color", "#4888BF")
							.style("margin-right", "1px")
							.style("padding", "7px 6px 5px 6px")
							.style("font-size", ".7em")
							.style("text-transform", "uppercase")
							.text("or")
					} else {
						make_plus_btn(one_term_div, data, obj.group.terms[i].values, terms_div)
					}
				}
			} else if (term.term.isinteger || term.term.isfloat) {
				// TODO numerical term, print range in value button and apply the suitable click callback
				await display_numeric_filter(obj.group, i, one_term_div)
			} else if (term.term.iscondition) {
				// for overlay between grade and subcategory
				if (term.grade_and_child) {
					for (let j = 0; j < term.grade_and_child.length; j++) {
						term_value_div
							.append("div")
							.attr("class", "sja_filter_tag_btn value_btn")
							.style("font-size", "1em")
							.style("padding", "3px 4px 3px 4px")
							.style("margin-right", "1px")
							.style("background-color", "#4888BF")
							.text(term.grade_and_child[j].grade_label)

						term_value_div
							.append("div")
							.style("display", "inline-block")
							.style("color", "#fff")
							.style("background-color", "#4888BF")
							.style("margin-right", "1px")
							.style("padding", "7px 6px 5px 6px")
							.style("font-size", ".7em")
							.style("text-transform", "uppercase")
							.text("AND")

						term_value_div
							.append("div")
							.attr("class", "sja_filter_tag_btn value_btn")
							.style("font-size", "1em")
							.style("padding", "3px 4px 3px 4px")
							.style("margin-right", "1px")
							.style("background-color", "#4888BF")
							.text(term.grade_and_child[j].child_label)
					}
				}
				// for non-leaf term - bar by subcategry
				else if (term.bar_by_children) {
					// query db for list of sub-categories and count
					const lst = ["bar_by_children=1"]
					if (term.value_by_max_grade) lst.push("value_by_max_grade=1")
					else if (term.value_by_most_recent) lst.push("value_by_most_recent=1")
					else if (term.value_by_computable_grade) lst.push("value_by_computable_grade=1")
					const data = await getcategories(term, lst)

					for (let j = 0; j < term.values.length; j++) {
						const [subcategroy_select, term_value_btn] = dom.make_select_btn_pair(one_term_div)
						subcategroy_select.style("margin-right", "1px")
						make_select_list(data, subcategroy_select, term.values, term.values[j].key, "delete")

						subcategroy_select.on("change", async () => {
							//if value is 'delete' then remove from group
							if (subcategroy_select.node().value == "delete") {
								obj.group.terms[i].values.splice(j, 1)
								if (obj.group.terms[i].values.length == 0) {
									obj.group.terms.splice(i, 1)
								}
							} else {
								//change value of button
								const new_value = data.lst.find(j => j.key == subcategroy_select.node().value)
								term_value_btn.style("padding", "3px 4px 3px 4px").text("Loading...")
								obj.group.terms[i].values[j] = { key: new_value.key, label: new_value.label }
							}

							//update gorup and load tk
							await obj.callback()
						})

						term_value_btn
							.attr("class", "sja_filter_tag_btn value_btn")
							.style("font-size", "1em")
							.style("padding", "2px 4px 3px 4px")
							.style("margin-right", "1px")
							.style("background-color", "#4888BF")
							.html(term.values[j].label + " &#9662;")

						subcategroy_select.style("width", term_value_btn.node().offsetWidth + "px")

						if (j < term.values.length - 1) {
							one_term_div
								.append("div")
								.style("display", "inline-block")
								.style("color", "#fff")
								.style("background-color", "#4888BF")
								.style("margin-right", "1px")
								.style("padding", "7px 6px 5px 6px")
								.style("font-size", ".7em")
								.style("text-transform", "uppercase")
								.text("or")
						}
					}

					make_plus_btn(one_term_div, data, obj.group.terms[i].values, terms_div)
				} else if (term.bar_by_grade) {
					// query db for list of grade and count
					const lst = ["bar_by_grade=1"]
					if (term.value_by_max_grade) lst.push("value_by_max_grade=1")
					else if (term.value_by_most_recent) lst.push("value_by_most_recent=1")
					else if (term.value_by_computable_grade) lst.push("value_by_computable_grade=1")
					const data = await getcategories(term, lst)

					for (let j = 0; j < term.values.length; j++) {
						const [grade_select, term_value_btn] = dom.make_select_btn_pair(one_term_div)
						grade_select.style("margin-right", "1px")

						make_select_list(data, grade_select, term.values, term.values[j].key, "delete")

						grade_select.on("change", async () => {
							//if value is 'delete' then remove from group
							if (grade_select.node().value == "delete") {
								obj.group.terms[i].values.splice(j, 1)
								if (obj.group.terms[i].values.length == 0) {
									obj.group.terms.splice(i, 1)
								}
							} else {
								//change value of button
								const new_value = data.lst.find(j => j.key == grade_select.node().value)
								term_value_btn.style("padding", "3px 4px 3px 4px").text("Loading...")
								obj.group.terms[i].values[j] = { key: new_value.key, label: new_value.label }
							}

							//update gorup and load tk
							await obj.callback()
						})

						term_value_btn
							.style("font-size", "1em")
							.style("padding", "2px 4px 3px 4px")
							.style("margin-right", "1px")
							.style("background-color", "#4888BF")
							.html(term.values[j].label + " &#9662;")

						grade_select.style("width", term_value_btn.node().offsetWidth + "px")

						if (j < term.values.length - 1) {
							one_term_div
								.append("div")
								.style("display", "inline-block")
								.style("color", "#fff")
								.style("background-color", "#4888BF")
								.style("margin-right", "1px")
								.style("padding", "7px 6px 5px 6px")
								.style("font-size", ".7em")
								.style("text-transform", "uppercase")
								.text("or")
						}
					}

					make_grade_select_btn(one_term_div, term, terms_div)

					make_plus_btn(one_term_div, data, obj.group.terms[i].values, terms_div)
				}
			}

			// button with 'x' to remove term2
			one_term_div
				.append("div")
				.attr("class", "sja_filter_tag_btn term_remove_btn")
				.style("padding", "3px 6px 3px 4px")
				.style("border-radius", "0 6px 6px 0")
				.style("background-color", "#4888BF")
				.html("&#215;")
				.on("click", async () => {
					obj.group.terms.splice(i, 1)
					// may_settoloading_termgroup( group )
					await obj.callback()
				})
		}

		if (obj.postRenderCallback) {
			// call via the selection to hopefully sequence
			// after all other .remove(), .append()
			terms_div.call(obj.postRenderCallback)
		}
	}

	async function getcategories(term, lst) {
		let tvslst_filter_str = false

		if (obj.tvslst_filter) {
			tvslst_filter_str = encodeURIComponent(JSON.stringify(to_parameter(obj.tvslst_filter)))
		}

		const args = [
			"genome=" +
				obj.genome.name +
				"&dslabel=" +
				obj.mds.label +
				"&getcategories=1&tid=" +
				term.term.id +
				"&tvslst=" +
				tvslst_filter_str
		]
		if (lst) args.push(...lst)

		let data
		try {
			data = await client.dofetch2("/termdb?" + args.join("&"))
			if (data.error) throw data.error
		} catch (e) {
			window.alert(e.message || e)
		}
		return data
	}

	async function add_term(result) {
		// Add new term to group.terms
		for (const [i, bar_term] of result.terms.entries()) {
			obj.group.terms.push(bar_term)
		}

		// update the group div with new terms
		await obj.callback()
	}

	function make_select_list(data, select, selected_values, btn_value, first_option) {
		if (data.lst) {
			if (first_option == "delete") {
				select
					.append("option")
					.attr("value", "delete")
					.html("&times;&nbsp;&nbsp;Delete")
			} else if (first_option == "add") {
				select
					.append("option")
					.attr("value", "add")
					.property("disabled", true)
					.html("--- Add New Category ---")
			}

			for (const category of data.lst) {
				select
					.append("option")
					.attr("value", category.key)
					.text(category.label + "\t(n=" + category.samplecount + ")")
			}

			//if more than 1 categories exist, disable other from the dropdown to avoid duplicate selection
			if (btn_value) {
				const options = select.selectAll("option")

				options.nodes().forEach(function(d) {
					if (selected_values.find(v => v.key == d.value) && d.value != btn_value) {
						d.disabled = true
					}
				})

				select.node().value = btn_value
			}
		} else {
			select.append("option").text("ERROR: Can't get the data")
		}
	}

	function make_plus_btn(holder, data, selected_values, terms_div) {
		// If 2 or less values for the term then remove plus button
		if (data.lst.length <= 2) return

		const [add_value_select, add_value_btn] = dom.make_select_btn_pair(holder)
		add_value_select.style("margin-right", "1px")

		add_value_select.selectAll("option").remove()

		make_select_list(data, add_value_select, selected_values, false, "add")

		//for numerical term, add option to add another bin
		if (data.lst[0].range) {
			add_value_select
				.append("option")
				.attr("value", "add_bin")
				.text("Add new range")
		}

		//disable categories already selected
		const options = add_value_select.selectAll("option")

		options.nodes().forEach(function(d) {
			for (const [i, value] of selected_values.entries()) {
				if (value.key && value.key == d.value) d.disabled = true
				if (value.value != undefined && value.label == d.value) d.disabled = true
			}
		})

		if (data.lst) add_value_select.node().value = "add"

		add_value_select.on("change", async () => {
			if (add_value_select.node().value == "add_bin") {
				const range_temp = { start: "", stop: "" }
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
			.attr("class", "sja_filter_tag_btn add_value_btn")
			.style("padding", "3px 4px 3px 4px")
			.style("margin-right", "1px")
			.style("font-size", "1em")
			.style("background-color", "#4888BF")
			.html("&#43;")

		// limit dropdown menu width to width of term_value_btn (to avoid overflow)
		add_value_select.style("width", add_value_btn.node().offsetWidth + "px")
	}

	function make_grade_select_btn(holder, term, terms_div) {
		const [grade_type_select, grade_type_btn] = dom.make_select_btn_pair(holder)
		grade_type_select.style("margin-right", "1px")

		grade_type_select
			.append("option")
			.attr("value", "max")
			.text("Max grade per patient")

		grade_type_select
			.append("option")
			.attr("value", "recent")
			.text("Most recent grade per patient")

		grade_type_select
			.append("option")
			.attr("value", "computable")
			.text("Any grade per patient")

		grade_type_btn
			.style("padding", "2px 4px 3px 4px")
			.style("margin-right", "1px")
			.style("font-size", "1em")
			.style("background-color", "#4888BF")

		if (term.value_by_max_grade) {
			grade_type_btn.html("(Max grade per patient) &#9662;")
			grade_type_select.node().value = "max"
		} else if (term.value_by_most_recent) {
			grade_type_btn.html("(Most recent grade per patient) &#9662;")
			grade_type_select.node().value = "recent"
		} else if (term.value_by_computable_grade) {
			grade_type_btn.html("(Any grade per patient) &#9662;")
			grade_type_select.node().value = "computable"
		}

		grade_type_select.style("width", grade_type_btn.node().offsetWidth + "px")

		// change grade type to/from max_grade and recent_grade
		grade_type_select.on("change", async () => {
			if (grade_type_select.node().value == "max") {
				term.value_by_max_grade = true
				term.value_by_most_recent = false
				term.value_by_computable_grade = false
			} else if (grade_type_select.node().value == "recent") {
				term.value_by_max_grade = false
				term.value_by_most_recent = true
				term.value_by_computable_grade = false
			} else if (grade_type_select.node().value == "computable") {
				term.value_by_max_grade = false
				term.value_by_most_recent = false
				term.value_by_computable_grade = true
			}

			//update gorup and load tk
			await obj.callback()
		})
	}

	async function replace_term(result, term_replce_index) {
		// create new array with updated terms
		let new_terms = []

		for (const [i, term] of obj.group.terms.entries()) {
			// replace the term by index of clicked term
			if (i == term_replce_index) {
				for (const [j, bar_term] of result.terms.entries()) {
					new_terms.push(bar_term)
				}
			} else {
				new_terms.push(term)
			}
		}

		// assing new terms to group
		obj.group.terms = new_terms

		// update the group div with new terms
		await obj.callback()
	}

	async function display_numeric_filter(group, term_index, value_div) {
		const numeric_term = group.terms[term_index]

		const data = await getcategories(numeric_term)
		const unannotated_cats = { lst: [] }

		for (const [index, cat] of data.lst.entries()) {
			if (cat.range.value != undefined) {
				unannotated_cats.lst.push(cat)
			}
		}

		for (const [i, range] of numeric_term.ranges.entries()) {
			if (range.value != undefined) {
				const [numeric_select, value_btn] = dom.make_select_btn_pair(value_div)
				numeric_select.style("margin-right", "1px")

				make_select_list(unannotated_cats, numeric_select, numeric_term, null, "delete")

				value_btn
					.attr("class", "sja_filter_tag_btn value_btn")
					.style("padding", "3px 4px 3px 4px")
					.style("margin-right", "1px")
					.style("font-size", "1em")
					.style("background-color", "#4888BF")
					.html(range.label)

				numeric_select.node().value = range.label

				numeric_select.style("width", value_btn.node().offsetWidth + "px")

				// change categroy from dropdown
				numeric_select.on("change", async () => {
					//if value is 'delete' then remove from group
					if (numeric_select.node().value == "delete") {
						numeric_term.ranges.splice(i, 1)
						if (numeric_term.ranges.length == 0) {
							group.terms.splice(term_index, 1)
						}
					} else {
						//change value of button
						const new_value = data.lst.find(j => j.label == numeric_select.node().value)

						value_btn.style("padding", "3px 4px 3px 4px").text("Loading...")

						numeric_select.style("width", value_btn.node().offsetWidth + "px")

						group.terms[term_index].range = new_value.range
					}

					//update gorup and load tk
					await obj.callback()
				})
			} else {
				const numeric_div = value_div
					.append("div")
					.attr("class", "sja_filter_tag_btn value_btn")
					.style("font-size", "1em")
					.style("padding", "3px 5px 3px 5px")
					.style("margin-right", "1px")
					.style("background-color", "#4888BF")

				numeric_div.selectAll("*").remove()

				const x = '<span style="font-family:Times;font-style:italic">x</span>'
				if (range.startunbounded) {
					numeric_div.html(x + " " + (range.stopinclusive ? "&le;" : "&lt;") + " " + range.stop)
				} else if (range.stopunbounded) {
					numeric_div.html(x + " " + (range.startinclusive ? "&ge;" : "&gt;") + " " + range.start)
				} else {
					numeric_div.html(
						range.start +
							" " +
							(range.startinclusive ? "&le;" : "&lt;") +
							" " +
							x +
							" " +
							(range.stopinclusive ? "&le;" : "&lt;") +
							" " +
							range.stop
					)
				}

				numeric_div.on("click", () => {
					edit_numeric_bin(numeric_div, range)
				})
			}

			//OR button in bwtween ranges
			if (i < numeric_term.ranges.length - 1) {
				value_div
					.append("div")
					.style("display", "inline-block")
					.style("color", "#fff")
					.style("background-color", "#4888BF")
					.style("margin-right", "1px")
					.style("padding", "7px 6px 5px 6px")
					.style("font-size", ".7em")
					.style("text-transform", "uppercase")
					.text("or")
			}
		}

		make_plus_btn(value_div, unannotated_cats, numeric_term.ranges, terms_div)
	}

	function edit_numeric_bin(holder, range, callback) {
		obj.tvstip.clear()

		const equation_div = obj.tvstip.d
			.append("div")
			.style("display", "block")
			.style("padding", "3px 5px")

		const start_input = equation_div
			.append("input")
			.attr("type", "number")
			.attr("value", range.start)
			.style("width", "60px")
			.on("keyup", async () => {
				if (!client.keyupEnter()) return
				start_input.property("disabled", true)
				await apply()
				start_input.property("disabled", false)
			})

		// to replace operator_start_div
		const startselect = equation_div.append("select").style("margin-left", "10px")

		startselect.append("option").html("&le;")
		startselect.append("option").html("&lt;")
		startselect.append("option").html("&#8734;")

		startselect.node().selectedIndex = range.startunbounded ? 2 : range.startinclusive ? 0 : 1

		const x = '<span style="font-family:Times;font-style:italic">x</span>'

		equation_div
			.append("div")
			.style("display", "inline-block")
			.style("padding", "3px 10px")
			.html(x)

		// to replace operator_end_div
		const stopselect = equation_div.append("select").style("margin-right", "10px")

		stopselect.append("option").html("&le;")
		stopselect.append("option").html("&lt;")
		stopselect.append("option").html("&#8734;")

		stopselect.node().selectedIndex = range.stopunbounded ? 2 : range.stopinclusive ? 0 : 1

		const stop_input = equation_div
			.append("input")
			.attr("type", "number")
			.style("width", "60px")
			.attr("value", range.stop)
			.on("keyup", async () => {
				if (!client.keyupEnter()) return
				stop_input.property("disabled", true)
				await apply()
				stop_input.property("disabled", false)
			})

		obj.tvstip.d
			.append("div")
			.attr("class", "sja_menuoption")
			.style("text-align", "center")
			.text("APPLY")
			.on("click", () => {
				obj.tvstip.hide()
				apply()
			})

		// tricky: only show tip when contents are filled, so that it's able to detect its dimention and auto position itself
		obj.tvstip.showunder(holder.node())

		async function apply() {
			try {
				if (startselect.node().selectedIndex == 2 && stopselect.node().selectedIndex == 2)
					throw "Both ends can not be unbounded"

				const start = startselect.node().selectedIndex == 2 ? null : Number(start_input.node().value)
				const stop = stopselect.node().selectedIndex == 2 ? null : Number(stop_input.node().value)
				if (start != null && stop != null && start >= stop) throw "start must be lower than stop"

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
				obj.tvstip.hide()
				await obj.callback()
				if (callback) callback(range)
			} catch (e) {
				window.alert(e)
			}
		}
	}
}

// function may_settoloading_termgroup ( group ) {
// 	if( group.div_numbersamples ) group.div_numbersamples.text('Loading...')
// 	if(group.div_populationaverage) {
// 		group.div_populationaverage.selectAll('*').remove()
// 		group.div_populationaverage.append('div').text('Loading...')
// 	}
// }

export function to_parameter(terms) {
	// apply on the terms[] array of a group
	// TODO and/or between multiple terms
	return terms.map(i => {
		return {
			term: {
				id: i.term.id,
				iscategorical: i.term.iscategorical,
				isfloat: i.term.isfloat,
				isinteger: i.term.isinteger,
				iscondition: i.term.iscondition
			},
			// must return original values[{key,label}] to keep the validator function happy on both client/server
			values: i.values,
			ranges: i.ranges,
			isnot: i.isnot,
			bar_by_grade: i.bar_by_grade,
			bar_by_children: i.bar_by_children,
			value_by_max_grade: i.value_by_max_grade,
			value_by_most_recent: i.value_by_most_recent,
			grade_and_child: i.grade_and_child
		}
	})
}
