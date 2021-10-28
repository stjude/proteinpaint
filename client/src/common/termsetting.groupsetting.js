import { keyupEnter } from '../client'
import { select } from 'd3-selection'

export function setGroupsettingMethods(self) {
	self.regroupMenu = function(grp_count, temp_cat_grps) {
        console.log(self.q.groupsetting)
		//start with default 2 groups, extra groups can be added by user
		const default_grp_count = grp_count || 2
		const values = self.q.bar_by_children ? self.term.subconditions : self.term.values
		const cat_grps = temp_cat_grps || JSON.parse(JSON.stringify(values))
        const default_1grp = [{values : Object.values(values).map( v => {return {key: v.label}})}]
        const default_empty_group = { values: []}
        const empty_groups = Array(default_grp_count-1).fill(default_empty_group)
        const default_groupset = {groups: [...default_1grp, ...empty_groups]}

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
				: default_groupset

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
			.property('disabled', self.q.mode == 'binary' ? true : false)
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

		const groups_holder = group_edit_div.append('div')

		const groups_divs = groups_holder.selectAll(':scope > div').data(groupset.groups)

		groups_divs
			.enter()
			.append('div')
			.each(addGroupDiv)

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
				self.q.type = 'custom-groupset'
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

	function addGroupDiv(group, i) {
		console.log(group, i)

		// const values = self.q.bar_by_children ? self.term.subconditions : self.term.values
		// const cat_grps = JSON.parse(JSON.stringify(values))
		const group_val_keys = group.values.map(v => v.key.toString())
		// console.log(group_val_keys, cat_grps)

		const group_div = select(this)

		const title_div = group_div
			.append('div')
			.style('border-top', '1px solid #bbb')
			.style('margin-top', '25px')

		title_div
			.append('div')
			.style('display', 'inline-block')
			.style('position', 'relative')
			.style('top', '-25px')
			.style('border-radius', '13px')
			.style('margin', '15px')
			.style('margin-bottom', '-10px')
			.style('padding', '3px 10px')
			.style('text-align', 'center')
			.style('font-size', '.8em')
			.style('text-transform', 'uppercase')
			.style('border', '1px solid #bbb')
			.style('color', '#999')
			.style('background-color', '#fff')
			.text('Group ' + (i + 1))

		const group_rename_div = group_div
			.append('div')
			.attr('class', 'group_edit_div')
			.style('display', 'inline-block')

		group_rename_div
			.append('label')
			.attr('for', 'grp_ct')
			.style('display', 'inline-block')
			.style('margin-right', '15px')
			.html('Group name')

		const group_name_input = group_rename_div
			.append('input')
			.attr('size', 12)
			.attr('value', group.name || i + 1)
			.style('margin', '2px 5px')
			.style('display', 'inline-block')
			.style('font-size', '.8em')
			.style('width', '80px')
			.on('keyup', () => {
				if (!keyupEnter()) return
				// TODO
				// //update customset and add to self.q
				// for (const [key, val] of Object.entries(cat_grps)) {
				// 	for (let j = 0; j < default_grp_count; j++) {
				// 		if (cat_grps[key].group == j + 1) customset.groups[j].values.push({ key: key })
				// 	}
				// }

				// customset.groups[i].name = group_name_input.node().value
				// self.q.type = 'custom-groupset'
				// self.q.groupsetting = {
				// 	inuse: true,
				// 	customset: customset
				// 	//predefined_groupset_idx: removed from this q.groupsetting
				// }

				// self.regroupMenu(default_grp_count, cat_grps)
			})

		const group_select_div = group_div.append('div')
            .style('margin', '5px')
            .style('overflow-x','hidden')
            .style('overflow-y','auto')
            .style('max-height','300px')

		const group_table = group_select_div.append('table').style('border-collapse', 'collapse')

		// for each cateogry add new row with radio button for each group and category name
		for (const [key, val] of Object.entries(cat_grps)) {
			const cat_tr = group_table
				.append('tr')
				.on('mouseover', () => {
					cat_tr.style('background-color', '#eee')
				})
				.on('mouseout', () => {
					cat_tr.style('background-color', '#fff')
				})

			cat_tr
				.append('td')
				.attr('align', 'center')
				.style('padding', '2px 5px')
				.append('input')
				.attr('type', 'checkbox')
				.attr('name', key)
				.attr('value', i)
				.property('checked', () => {
					return group_val_keys.includes(key)
				})
				.on('click', () => {
					// TODO
					// cat_grps[key].group = i + 1
				})

			cat_tr
				.append('td')
				.style('display', 'inline-block')
				.style('margin', '2px')
				.style('cursor', 'default')
				.html(val.label)
		}
	}
    }

	/*
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
					if (!keyupEnter()) return

					//update customset and add to self.q
					for (const [key, val] of Object.entries(cat_grps)) {
						for (let j = 0; j < default_grp_count; j++) {
							if (cat_grps[key].group == j + 1) customset.groups[j].values.push({ key: key })
						}
					}

					customset.groups[i].name = group_name_input.node().value
					self.q.type = 'custom-groupset'
					self.q.groupsetting = {
						inuse: true,
						customset: customset
						//predefined_groupset_idx: removed from this q.groupsetting
					}

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
		*/
}
