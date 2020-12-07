import * as client from '../client'

/*
Arguments
self: a termsetting instance
*/

export function setCategoricalMethods(self) {
	self.showEditMenu = function(div) {
		self.showGrpOpts(div)
	}

	self.term_name_gen = function(d) {
		return d.name.length <= 20
			? d.name
			: '<label title="' + d.name + '">' + d.name.substring(0, 18) + '...' + '</label>'
	}

	self.get_status_msg = function() {
		// get message text for the right half pill; may return null
		if (self.q.groupsetting && self.q.groupsetting.inuse) {
			if (Number.isInteger(self.q.groupsetting.predefined_groupset_idx)) {
				if (!self.term.groupsetting) return 'term.groupsetting missing'
				if (!self.term.groupsetting.lst) return 'term.groupsetting.lst[] missing'
				const i = self.term.groupsetting.lst[self.q.groupsetting.predefined_groupset_idx]
				if (!i) return 'term.groupsetting.lst[' + self.q.groupsetting.predefined_groupset_idx + '] missing'
				return i.name
			}
			if (self.q.groupsetting.customset) {
				const n = self.q.groupsetting.customset.groups.length
				if (self.q.bar_by_grade) return n + ' groups of grades'
				if (self.q.bar_by_children) return n + ' groups of sub-conditions'
				return 'Divided into ' + n + ' groups'
			}
			return 'Unknown setting for groupsetting'
		}
		if (self.term.type == 'condition') {
			if (self.q.bar_by_grade) {
				if (self.q.value_by_max_grade) return 'Max. Grade'
				if (self.q.value_by_most_recent) return 'Most Recent Grade'
				if (self.q.value_by_computable_grade) return 'Any Grade'
				return 'Error: unknown grade setting'
			}
			if (self.q.bar_by_children) {
				return 'Sub-condition'
			}
			return 'Error: unknown setting for term.type == "condition"'
		}
		return null // for no label
	}

	/******************* Functions for Categorical terms *******************/
	self.showGrpOpts = async function(div) {
		const grpsetting_flag = self.q && self.q.groupsetting && self.q.groupsetting.inuse
		const predefined_group_name =
			self.term.groupsetting &&
			self.term.groupsetting.lst &&
			self.q.groupsetting &&
			self.q.groupsetting.predefined_groupset_idx != undefined
				? self.term.groupsetting.lst[self.q.groupsetting.predefined_groupset_idx].name
				: ''
		const values = self.q.bar_by_children ? self.term.subconditions : self.term.values

		const active_group_info_div = div.append('div').style('margin', '10px')

		// if using predfined groupset, display name
		active_group_info_div
			.append('div')
			.style('display', grpsetting_flag && predefined_group_name ? 'block' : 'none')
			.style('font-size', '.9em')
			.style('font-weight', 'bold')
			.style('text-align', 'center')
			.style('padding-bottom', '5px')
			.html('Using ' + predefined_group_name)

		//display groups and categories assigned to that group
		if (grpsetting_flag) {
			const groupset =
				self.q.groupsetting.predefined_groupset_idx != undefined
					? self.term.groupsetting.lst[self.q.groupsetting.predefined_groupset_idx]
					: self.q.groupsetting.customset || undefined

			const group_table = active_group_info_div.append('table').style('font-size', '.8em')

			for (const [i, g] of groupset.groups.entries()) {
				const group_tr = group_table.append('tr')

				//group name
				group_tr
					.append('td')
					.style('font-weight', 'bold')
					.style('vertical-align', 'top')
					.html(g.name != undefined ? g.name + ':' : 'Group ' + (i + 1) + ':')

				const values_td = group_tr.append('td')

				for (const v of g.values) {
					values_td.append('div').html(values[v.key].label)
				}
			}

			//redevide groups btn
			div
				.append('div')
				.attr('class', 'group_btn sja_menuoption')
				.style('display', 'block')
				// .style('padding', '7px 6px')
				.style('margin', '5px')
				.style('text-align', 'center')
				.style('font-size', '.8em')
				.style('border-radius', '12px')
				.html('Redivide groups')
				.on('click', () => {
					const valGrp = self.grpSet2valGrp(groupset)
					self.regroupMenu(groupset.groups.length, valGrp)
				})
		}

		const default_btn_txt =
			(!grpsetting_flag ? 'Using' : 'Use') +
			' default categories ' +
			(values ? '(n=' + Object.keys(values).length + ')' : '')

		// default overlay btn - devide to n groups (n=total)
		div
			.append('div')
			.attr('class', 'group_btn sja_menuoption')
			.style('display', 'block')
			// .style('padding', '7px 6px')
			.style('margin', '5px')
			.style('text-align', 'center')
			.style('font-size', '.8em')
			.style('border-radius', '13px')
			.style('background-color', !grpsetting_flag ? '#fff' : '#eee')
			.style('color', !grpsetting_flag ? '#888' : '#000')
			.style('pointer-events', !grpsetting_flag ? 'none' : 'auto')
			.text(default_btn_txt)
			.on('click', () => {
				self.q.groupsetting.inuse = false
				delete self.q.groupsetting.predefined_groupset_idx
				self.dom.tip.hide()
				self.opts.callback({
					term: self.term,
					q: self.q
				})
			})

		//show button/s for default groups
		if (self.term.groupsetting && self.term.groupsetting.lst) {
			for (const [i, group] of self.term.groupsetting.lst.entries()) {
				if (self.q.groupsetting && self.q.groupsetting.predefined_groupset_idx != i)
					div
						.append('div')
						.attr('class', 'group_btn sja_menuoption')
						.style(
							'display',
							(group.is_grade && !self.q.bar_by_grade) || (group.is_subcondition && !self.q.bar_by_children)
								? 'none'
								: 'block'
						)
						// .style('padding', '7px 6px')
						.style('margin', '5px')
						.style('text-align', 'center')
						.style('font-size', '.8em')
						.style('border-radius', '13px')
						.html('Use <b>' + group.name + '</b>')
						.on('click', () => {
							self.q.groupsetting.inuse = true
							self.q.groupsetting.predefined_groupset_idx = i
							self.dom.tip.hide()
							self.opts.callback({
								term: self.term,
								q: self.q
							})
						})
			}
		}

		// devide to grpups btn
		div
			.append('div')
			.attr('class', 'group_btn sja_menuoption')
			.style(
				'display',
				(self.term.groupsetting && self.term.groupsetting.disabled) || grpsetting_flag ? 'none' : 'block'
			)
			// .style('padding', '7px 6px')
			.style('margin', '5px')
			.style('text-align', 'center')
			.style('font-size', '.8em')
			.style('border-radius', '13px')
			.html(
				'Divide <b>' +
					(self.term.name.length > 25 ? self.term.name.substring(0, 24) + '...' : self.term.name) +
					'</b> to groups'
			)
			.on('click', () => {
				self.regroupMenu()
			})
	}

	self.regroupMenu = function(grp_count, temp_cat_grps) {
		//start with default 2 groups, extra groups can be added by user
		const default_grp_count = grp_count || 2
		const values = self.q.bar_by_children ? self.term.subconditions : self.term.values
		const cat_grps = temp_cat_grps || JSON.parse(JSON.stringify(values))

		//initiate empty customset
		let customset = { groups: [] }
		let group_names = []
		if (self.q.bar_by_grade) customset.is_grade = true
		else if (self.q.bar_by_children) customset.is_subcondition = true

		const grpsetting_flag = self.q && self.q.groupsetting && self.q.groupsetting.inuse
		const groupset =
			grpsetting_flag && self.q.groupsetting.predefined_groupset_idx != undefined
				? self.term.groupsetting.lst[self.q.groupsetting.predefined_groupset_idx]
				: self.q.groupsetting && self.q.groupsetting.customset
				? self.q.groupsetting.customset
				: undefined

		for (let i = 0; i < default_grp_count; i++) {
			let group_name =
				groupset && groupset.groups && groupset.groups[i] && groupset.groups[i].name
					? groupset.groups[i].name
					: undefined

			if (self.q.bar_by_grade && groupset && groupset.is_subcondition) group_name = undefined
			if (self.q.bar_by_children && groupset && groupset.is_grade) group_name = undefined

			group_names.push(group_name)

			customset.groups.push({
				values: [],
				name: group_name
			})
		}

		self.dom.tip.clear().showunder(self.dom.holder.node())

		const regroup_div = self.dom.tip.d.append('div').style('margin', '10px')

		const button_div = regroup_div
			.append('div')
			.style('text-align', 'center')
			.style('margin', '5px')

		const group_edit_div = regroup_div.append('div').style('margin', '5px')
		const group_ct_div = group_edit_div.append('div').attr('class', 'group_edit_div')
		group_ct_div
			.append('label')
			.attr('for', 'grp_ct')
			.style('display', 'inline-block')
			.html('#groups')

		const group_ct_select = group_ct_div
			.append('select')
			.style('margin-left', '15px')
			.style('margin-bottom', '7px')
			.on('change', () => {
				if (group_ct_select.node().value < default_grp_count) {
					const grp_diff = default_grp_count - group_ct_select.node().value
					for (const [key, val] of Object.entries(cat_grps)) {
						if (cat_grps[key].group > group_ct_select.node().value) cat_grps[key].group = 1
					}
					self.regroupMenu(default_grp_count - grp_diff, cat_grps)
				} else if (group_ct_select.node().value > default_grp_count) {
					const grp_diff = group_ct_select.node().value - default_grp_count
					self.regroupMenu(default_grp_count + grp_diff, cat_grps)
				}
			})

		for (let i = 0; i < default_grp_count + 2; i++)
			group_ct_select
				.append('option')
				.attr('value', i + 1)
				.html(i + 1)

		group_ct_select.node().value = default_grp_count

		const group_rename_div = group_edit_div
			.append('div')
			.attr('class', 'group_edit_div')
			.style('display', 'inline-block')

		group_rename_div
			.append('label')
			.attr('for', 'grp_ct')
			.style('display', 'inline-block')
			.style('margin-right', '15px')
			.html('Names')

		for (let i = 0; i < default_grp_count; i++) {
			const group_name_input = group_rename_div
				.append('input')
				.attr('size', 12)
				.attr('value', group_names[i] || i + 1)
				.style('margin', '2px 5px')
				.style('display', 'inline-block')
				.style('font-size', '.8em')
				.style('width', '80px')
				.on('keyup', () => {
					if (!client.keyupEnter()) return

					//update customset and add to self.q
					for (const [key, val] of Object.entries(cat_grps)) {
						for (let j = 0; j < default_grp_count; j++) {
							if (cat_grps[key].group == j + 1) customset.groups[j].values.push({ key: key })
						}
					}

					customset.groups[i].name = group_name_input.node().value
					self.q.groupsetting.predefined_groupset_idx = undefined

					self.q.groupsetting = {
						inuse: true,
						customset: customset
					}
					self.opts.callback({
						term: self.term,
						q: self.q
					})

					self.regroupMenu(default_grp_count, cat_grps)
				})
		}

		group_edit_div
			.append('div')
			.style('font-size', '.6em')
			.style('margin-left', '10px')
			.style('color', '#858585')
			.text('Note: Press ENTER to update group names.')

		const group_select_div = regroup_div.append('div').style('margin', '5px')

		const group_table = group_select_div.append('table').style('border-collapse', 'collapse')

		// this row will have group names/number
		const group_name_tr = group_table.append('tr').style('height', '50px')

		group_name_tr
			.append('th')
			.style('padding', '2px 5px')
			.style('font-size', '.8em')
			.style('transform', 'rotate(315deg)')
			.html('Exclude')

		for (let i = 0; i < default_grp_count; i++) {
			group_name_tr
				.append('th')
				.style('padding', '2px 5px')
				.style('font-size', '.8em')
				.style('transform', 'rotate(315deg)')
				.html(group_names[i] || i + 1)
		}

		// for each cateogry add new row with radio button for each group and category name
		for (const [key, val] of Object.entries(values)) {
			const cat_tr = group_table
				.append('tr')
				.on('mouseover', () => {
					cat_tr.style('background-color', '#eee')
				})
				.on('mouseout', () => {
					cat_tr.style('background-color', '#fff')
				})

			//checkbox for exclude group
			cat_tr
				.append('td')
				.attr('align', 'center')
				.style('padding', '2px 5px')
				.append('input')
				.attr('type', 'radio')
				.attr('name', key)
				.attr('value', 0)
				.property('checked', () => {
					if (cat_grps[key].group === 0) {
						// cat_grps[key].group = 0
						return true
					}
				})
				.on('click', () => {
					cat_grps[key].group = 0
				})

			// checkbox for each group
			for (let i = 0; i < default_grp_count; i++) {
				cat_tr
					.append('td')
					.attr('align', 'center')
					.style('padding', '2px 5px')
					.append('input')
					.attr('type', 'radio')
					.attr('name', key)
					.attr('value', i)
					.property('checked', () => {
						if (!cat_grps[key].group && cat_grps[key].group !== 0) {
							cat_grps[key].group = 1
							return true
						} else {
							return cat_grps[key].group == i + 1 ? true : false
						}
					})
					.on('click', () => {
						cat_grps[key].group = i + 1
					})
			}

			// extra empty column for '+' button
			cat_tr.append('td')

			// categories
			cat_tr
				.append('td')
				.style('display', 'inline-block')
				.style('margin', '2px')
				.style('cursor', 'default')
				.html(val.label)
		}

		// 'Apply' button
		button_div
			.append('div')
			.attr('class', 'apply_btn sja_filter_tag_btn')
			.style('display', 'inline-block')
			.style('border-radius', '13px')
			// .style('padding', '7px 6px')
			.style('margin', '5px')
			.style('text-align', 'center')
			.style('font-size', '.8em')
			.style('text-transform', 'uppercase')
			.text('Apply')
			.on('click', () => {
				const name_inputs = group_rename_div.node().querySelectorAll('input')
				//update customset and add to self.q
				for (const key in cat_grps) {
					const i = cat_grps[key].group - 1
					const group = customset.groups[i]
					if (group) {
						group.name = name_inputs[i].value
						group.values.push({ key })
					}
				}
				self.q.groupsetting = {
					inuse: true,
					customset: customset
				}
				self.dom.tip.hide()
				self.opts.callback({
					term: self.term,
					q: self.q
				})
			})
	}

	/******************* Functions for to Conditional terms *******************/

	self.showConditionOpts = async function(div) {
		// grade/subcondtion value type
		const value_type_select = div
			.append('select')
			.style('margin', '5px 10px')
			.on('change', () => {
				// if changed from grade to sub or vice versa, set inuse = false
				if (
					(value_type_select.node().value == 'sub' && self.q.bar_by_grade) ||
					(value_type_select.node().value != 'sub' && self.q.bar_by_children)
				) {
					self.q.groupsetting.predefined_groupset_idx = undefined
					self.q.groupsetting.inuse = false
				}

				self.q.bar_by_grade = value_type_select.node().value == 'sub' ? false : true
				self.q.bar_by_children = value_type_select.node().value == 'sub' ? true : false
				self.q.value_by_max_grade = value_type_select.node().value == 'max' ? true : false
				self.q.value_by_most_recent = value_type_select.node().value == 'recent' ? true : false
				self.q.value_by_computable_grade =
					value_type_select.node().value == 'computable' || value_type_select.node().value == 'sub' ? true : false

				self.dom.tip.hide()
				self.opts.callback({
					term: self.term,
					q: self.q
				})
			})

		value_type_select
			.append('option')
			.attr('value', 'max')
			.text('Max grade per patient')

		value_type_select
			.append('option')
			.attr('value', 'recent')
			.text('Most recent grade per patient')

		value_type_select
			.append('option')
			.attr('value', 'computable')
			.text('Any grade per patient')

		value_type_select
			.append('option')
			.attr('value', 'sub')
			.text('Sub-conditions')

		value_type_select.node().selectedIndex = self.q.bar_by_children
			? 3
			: self.q.value_by_computable_grade
			? 2
			: self.q.value_by_most_recent
			? 1
			: 0

		//options for grouping grades/subconditions
		self.showGrpOpts(div)
	}

	self.grpSet2valGrp = function(groupset) {
		const values = self.q.bar_by_children ? self.term.subconditions : self.term.values
		const vals_with_grp = JSON.parse(JSON.stringify(values))
		for (const [i, g] of groupset.groups.entries()) {
			for (const v of g.values) {
				vals_with_grp[v.key].group = i + 1
			}
		}

		for (const [key, val] of Object.entries(vals_with_grp)) {
			if (vals_with_grp[key].group == undefined) vals_with_grp[key].group = 0
		}

		return vals_with_grp
	}
}
