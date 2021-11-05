import { keyupEnter } from '../client'
import { select, event } from 'd3-selection'

/*
Arguments
self: a termsetting instance

methods added to self
regroupMenu()

other internal functions:
		addGroupHolder() //create holder for each group from groupset with group name input
		initDraggableDiv() // make draggable div to render drag-drop list of categories
		addGroupItems() // make drag-drop list of categories
*/

export function setGroupsettingMethods(self) {
	self.regroupMenu = function(grp_count, temp_cat_grps) {
		//start with default 2 groups, extra groups can be added by user
		const default_grp_count = grp_count || 2
		const values = self.q.bar_by_children ? self.term.subconditions : self.term.values
		const cat_grps = temp_cat_grps || JSON.parse(JSON.stringify(values))
		const default_1grp = [
			{
				values: Object.keys(values)
					.filter(key => {
						if (!values[key].uncomputable) return true
					})
					.map(key => {
						return { key, label: values[key].label }
					})
			}
		]
		const default_empty_group = { values: [] }
		const empty_groups = Array(default_grp_count - 1).fill(default_empty_group)
		const default_groupset = { groups: [...default_1grp, ...empty_groups] }
		const excluded_cats = []
		// to not change background of native group, keep track of dragged items original group
		let drag_native_grp, dragged_item
		Object.keys(cat_grps).forEach(key => {
			if (cat_grps[key].group == 0 || cat_grps[key].uncomputable == true)
				excluded_cats.push({ key, label: cat_grps[key].label })
		})

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

		const header_buttons_div = regroup_div
			.append('div')
			.attr('class', 'group_edit_div')
			.style('margin', '10px 5px 5px 5px')

		header_buttons_div
			.append('label')
			.attr('for', 'grp_ct')
			.style('display', 'inline-block')
			.html('Number of groups')

		const group_ct_select = header_buttons_div
			.append('select')
			.style('margin-left', '15px')
			.style('margin-bottom', '7px')
			.property('disabled', self.q.mode == 'binary' ? true : false)
			.on('change', () => {
				if (group_ct_select.node().value < default_grp_count) {
					const grp_diff = default_grp_count - group_ct_select.node().value
					for (const [key, val] of Object.entries(cat_grps)) {
						if (cat_grps[key].uncomputable) continue
						if (cat_grps[key].group > group_ct_select.node().value) cat_grps[key].group = 1
					}
					self.regroupMenu(default_grp_count - grp_diff, cat_grps)
				} else if (group_ct_select.node().value > default_grp_count) {
					const grp_diff = group_ct_select.node().value - default_grp_count
					for (const [key, val] of Object.entries(cat_grps)) {
						if (cat_grps[key].uncomputable) continue
						if (!cat_grps[key].group) cat_grps[key].group = 1
					}
					self.regroupMenu(default_grp_count + grp_diff, cat_grps)
				}
			})

		for (let i = 1; i < default_grp_count + 2; i++)
			group_ct_select
				.append('option')
				.attr('value', i + 1)
				.html(i + 1)

		group_ct_select.node().value = default_grp_count

		const groups_holder = regroup_div.append('div').style('border', '1px solid #efefef')

		const non_exclude_div = groups_holder.append('div').style('display', 'flex')

		// add holder for each group from groupset
		for (let i = 0; i < default_grp_count; i++) {
			const group = groupset.groups[i] || default_empty_group
			addGroupHolder(group, i)
		}

		// add Div for exclude without group rename input
		const exclude_div = initDraggableDiv(groups_holder, 'Excluded categories')

		exclude_div.style('border-top', '1px solid #efefef').on('drop', () => {
			addOnDrop(exclude_div, 0)
		})

		const exclude_list = exclude_div.append('div').style('margin', '5px')

		// show excluded categories
		addGroupItems(exclude_list, excluded_cats)

		// 'Apply' button
		header_buttons_div
			.append('div')
			.attr('class', 'apply_btn sja_filter_tag_btn')
			.style('display', 'inline-block')
			.style('border-radius', '13px')
			.style('text-align', 'center')
			.style('font-size', '.8em')
			.style('float', 'right')
			.style('text-transform', 'uppercase')
			.text('Apply')
			.on('click', () => {
				const name_inputs = groups_holder.node().querySelectorAll('input')
				//update customset and add to self.q
				for (const [key, val] of Object.entries(cat_grps)) {
					const i = cat_grps[key].group - 1
					const group = customset.groups[i]
					if (group) {
						group.name = name_inputs[i].value
						// for conditional terms, keys are string but digits, so check if it's parseInt(str)
						const key_ = typeof key == 'string' && !isNaN(parseInt(key)) ? parseInt(key) : key
						group.values.push({ key: key_, label: val.label })
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

		// create holder for each group from groupset with group name input
		function addGroupHolder(group, i) {
			const group_div = initDraggableDiv(non_exclude_div, 'Group ' + (i + 1), i + 1)

			group_div.style('border-right', i < default_grp_count - 1 ? '1px solid #efefef' : '').on('drop', () => {
				addOnDrop(group_list, i + 1)
			})

			const group_rename_div = group_div.append('div').attr('class', 'group_edit_div')

			const group_name_input = group_rename_div
				.append('input')
				.attr('size', 12)
				.attr('value', group && group.name ? group.name : i + 1)
				.style('margin', '5px')
				.style('margin-left', '8px')
				.style('display', 'inline-block')
				.style('font-size', '.8em')
				.style('width', '87%')
				.on('keyup', () => {
					if (!keyupEnter()) return

					customset.groups[i].name = group_name_input.node().value
					self.q.type = 'custom-groupset'
					self.q.groupsetting = {
						inuse: true,
						customset
					}
				})

			const group_list = group_div.append('div').style('margin', '5px')
			// show categories from the group
			addGroupItems(group_list, group.values)

			// help note for user to drag-drop in first group
			if (i == 0)
				group_div
					.style('position', 'relative')
					.append('div')
					.style('text-align', 'left')
					.style('font-size', '.6em')
					.style('color', '#999')
					// .style('position','absolute')
					.style('bottom', '10px')
					.text('Drag-and-drop to assign categories to groups.')
		}

		// make draggable div to render drag-drop list of categories
		function initDraggableDiv(holder, group_name, group_i) {
			const dragable_div = holder
				.append('div')
				.style('display', 'block')
				.style('padding', '10px')
				// .style('border', '1px solid #efefef')
				.style('vertical-align', 'top')
				.on('dragover', () => {
					event.preventDefault()
					event.stopPropagation()
					dragable_div.style('background-color', group_i !== drag_native_grp ? '#cfe2f3' : '#fff')
				})
				.on('dragenter', () => {
					event.preventDefault()
					event.stopPropagation()
					dragable_div.style('background-color', group_i !== drag_native_grp ? '#cfe2f3' : '#fff')
				})
				.on('dragleave', () => {
					event.preventDefault()
					event.stopPropagation()
					dragable_div.style('background-color', '#fff')
				})
				.on('dragend', () => {
					event.preventDefault()
					event.stopPropagation()
					dragable_div.style('background-color', '#fff')
				})

			// group title
			dragable_div
				.append('div')
				.style('display', 'block')
				.style('padding', '3px 10px')
				.style('text-align', 'left')
				.style('font-size', '.6em')
				.style('text-transform', 'uppercase')
				.style('color', '#999')
				.text(group_name)

			return dragable_div
		}

		// make drag-drop list of categories
		function addGroupItems(list_holder, values) {
			const group_items = list_holder.selectAll('div').data(values)
			group_items
				.enter()
				.append('div')
				.each(function(val) {
					if (cat_grps[val.key].group == undefined && !cat_grps[val.key].uncomputable) cat_grps[val.key].group = 1
					else if (cat_grps[val.key].group == undefined && cat_grps[val.key].uncomputable == true)
						cat_grps[val.key].group = 0
					const samplecount_obj = self.category2samplecount
						? self.category2samplecount.find(d => d.key == val.key)
						: 'n/a'
					const count =
						samplecount_obj !== undefined && samplecount_obj !== 'n/a'
							? samplecount_obj.count
							: samplecount_obj == undefined
							? 0
							: undefined

					const item = select(this)
						.attr('draggable', 'true')
						.attr('class', 'sj-drag-item')
						.style('margin', '3px')
						.style('cursor', 'default')
						.style('padding', '3px 10px')
						.style('border-radius', '5px')
						.html((val.label ? val.label : val.key) + (count !== undefined ? ' (n=' + count + ')' : ''))
						.style('background-color', '#eee')
						.on('mouseover', () => {
							item.style('background-color', '#fff2cc')
						})
						.on('mouseout', () => {
							item.style('background-color', '#eee')
						})
						.on('dragstart', () => {
							item.style('background-color', '#fff2cc')
							// attach id to dom, which is used by drop div to grab this dropped dom by id
							dragged_item = item
							drag_native_grp = cat_grps[val.key].group
						})
				})
		}

		function addOnDrop(group_list, group_i) {
			// move dom from one group holder to another group holder
			// if .group is same as previous, return (don't move or reorder categories)
			const val = dragged_item._groups[0][0].__data__ // get data attached to dom
			if (cat_grps[val.key].group == group_i) return
			else group_list.node().appendChild(dragged_item.node())

			// add transition effect on dragged item background
			dragged_item
				.style('transition-property', 'background-color')
				.style('transition-duration', '1s')
				.style('background-color', '#fff2cc')

			// update metadata for the category list (.group = 1 or 2 ..)
			cat_grps[val.key].group = group_i // update .group value based on drop group holder
		}
	}
}
