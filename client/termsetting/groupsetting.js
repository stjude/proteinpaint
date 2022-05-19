import { keyupEnter } from '../src/client'
import { select, event } from 'd3-selection'
import { filterInit } from '../filter/filter'
import { make_radios } from '../src/dom/radiobutton'

/*
Arguments
self: a termsetting instance

methods added to self
regroupMenu()

other internal functions:
	addGroupHolder() //create holder for each group from groupset with group name input
	initGroupDiv() //make draggable div to render drag-drop list of categories
	addGroupItems() //make drag-drop list of categories
	addOnDrop() //move dom from one group holder to another group holder
*/

export function setGroupsettingMethods(self) {
	self.regroupMenu = function(grp_count, temp_cat_grps) {
		if (self.q.mode == 'cutoff') {
			self.showCutoff()
		} else {
			self.showDraggables(grp_count, temp_cat_grps)
		}
	}
	self.showCutoff = function() {
		// regroup menu for cutoff mode
		// NOTE: assumes condition term. Eventually, apply to any ordinal term.
		self.dom.tip.clear().showunder(self.dom.holder.node())

		// div for cutoff drop-down menu
		const cutoff_div = self.dom.tip.d.append('div').style('margin', '10px')

		// get sorted list of grades
		const grades = Object.keys(self.term.values)
			.filter(k => !self.term.values[k].uncomputable && k !== '0')
			.sort((a, b) => Number(a) - Number(b))
			.map(k => {
				return { key: k, label: self.term.values[k].label }
			})

		// build drop-down menu
		const defaultCutoff = 'cutoff' in self.q ? self.q.cutoff : Number(grades[0].key)

		const cutoff_select = cutoff_div
			.append('div')
			//.style('display', 'inline')
			.text('Minimum grade for event: ')
			.append('select')
			.style('margin', '5px 10px')

		cutoff_select
			.selectAll('option')
			.data(grades)
			.enter()
			.append('option')
			.attr('value', d => d.key)
			.property('selected', d => Number(d.key) == defaultCutoff)
			.html(d => d.label)

		// div for time scale
		const scale_select = cutoff_div
			.append('div')
			.style('margin', '10px 0px')
			//.style('display', 'inline')
			.text('Time scale: ')
		const defaultScale = 'timeScale' in self.q ? self.q.timeScale : 'time'
		self.q.timeScale = defaultScale
		const scales = [
			{
				label: 'Time from study entry',
				value: 1,
				checked: defaultScale == 'time' ? true : false
			},
			{
				label: 'Age',
				value: 2,
				checked: defaultScale == 'age' ? true : false
			}
		]

		// build radio buttons for time scale
		make_radios({
			holder: scale_select,
			options: scales,
			callback: value => {
				self.q.timeScale = value == 1 ? 'time' : 'age'
			}
		})

		// 'Apply' button
		cutoff_div
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
				self.q.cutoff = Number(cutoff_select.property('value'))
				// split grades into two groups based on cutoff value

				// below cutoff group
				// 'no condition' and 'not tested' grades are always below cutoff
				const belowCutoff = [
					{
						key: '0',
						label: 'No condition'
					},
					{
						key: '-1',
						label: 'Not tested'
					}
				]
				belowCutoff.push(...grades.filter(grade => Number(grade.key) < self.q.cutoff))

				// above cutoff group
				const aboveCutoff = grades.filter(grade => Number(grade.key) >= self.q.cutoff)

				const groups = [
					{
						name: `Grade < ${self.q.cutoff}`,
						values: belowCutoff
					},
					{
						name: `Grade >= ${self.q.cutoff}`,
						values: aboveCutoff
					}
				]

				self.q.type = 'custom-groupset'
				self.q.groupsetting = {
					inuse: true,
					customset: {
						name: 'grade cutoff',
						is_grade: true,
						groups
					}
				}
				self.dom.tip.hide()
				self.runCallback()
			})

		// for description blurb
		// explain to user that 'no condition' and 'not tested' grades are below the grade cutoff for an event
		/*
		const descr_div = self.dom.tip.d.append('div').style('margin', '10px')
		descr_div
			.style('font-size', '0.8em')
			.style('text-align', 'left')
			.style('color', 'rgb(153, 153, 153)')
			.style('display', 'block')
			.text('')
		*/
	}

	self.showDraggables = function(grp_count, temp_cat_grps) {
		//start with default 2 groups, extra groups can be added by user
		const default_grp_count = grp_count || 2
		const values = self.q.bar_by_children ? self.term.subconditions : self.term.values
		const cat_grps = temp_cat_grps || JSON.parse(JSON.stringify(values))
		const default_1grp = [
			{
				type: 'values',
				values: Object.keys(values)
					.filter(key => {
						if (!values[key].uncomputable) return true
					})
					.map(key => {
						return { key, label: values[key].label }
					})
			}
		]
		const default_empty_group = { type: 'values', values: [] }
		const empty_groups = Array(default_grp_count - 1).fill(default_empty_group)
		const default_groupset = { groups: [...default_1grp, ...empty_groups] }
		const excluded_cats = []
		// to not change background of native group, keep track of dragged items original group
		let drag_native_grp, dragged_item

		const grpsetting_flag = self.q && self.q.groupsetting && self.q.groupsetting.inuse
		const groupset =
			grpsetting_flag && self.q.groupsetting.predefined_groupset_idx != undefined
				? self.term.groupsetting.lst[self.q.groupsetting.predefined_groupset_idx]
				: self.q.groupsetting && self.q.groupsetting.customset
				? self.q.groupsetting.customset
				: default_groupset

		Object.keys(cat_grps).forEach(key => {
			if (cat_grps[key].group == 0 || (!grpsetting_flag && cat_grps[key].uncomputable == true))
				excluded_cats.push({ key, label: cat_grps[key].label })
		})

		//initiate empty customset
		let customset = { groups: [] }
		let group_names = []
		if (self.q.bar_by_grade) customset.is_grade = true
		else if (self.q.bar_by_children) customset.is_subcondition = true

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
			.property('disabled', self.q.mode == 'binary' || self.q.mode == 'cutoff' ? true : false)
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

		// help note for user to drag-drop in first group
		regroup_div
			.append('div')
			.style('margin', '5px 2px')
			.style('font-size', '.6em')
			.style('color', '#999')
			.text('Drag-and-drop to assign categories to groups.')

		const groups_holder = regroup_div.append('div').style('border', '1px solid #efefef')

		const non_exclude_div = groups_holder.append('div').style('display', 'flex')

		for (let i = 0; i < default_grp_count; i++) {
			const group = groupset.groups[i] || default_empty_group
			addGroupHolder(group, i)
		}

		// add Div for exclude without group rename input
		const exclude_grp_args = {
			holder: groups_holder,
			name: 'Excluded categories',
			group_idx: 0
		}

		const exclude_div = initGroupDiv(exclude_grp_args)

		exclude_div.style('border-top', '1px solid #efefef').on('drop', () => {
			addOnDrop(exclude_list, 0)
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
						group.type = 'values'
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
				self.runCallback()
			})

		// create holder for each group from groupset with group name input
		function addGroupHolder(group, i) {
			const group_args = {
				holder: non_exclude_div,
				name: 'Group ' + (i + 1),
				group_idx: i + 1,
				group_type: group.type
			}
			const group_div = initGroupDiv(group_args)

			group_div.style('border-right', i < default_grp_count - 1 ? '1px solid #efefef' : '').on('drop', () => {
				addOnDrop(group_items_div, i + 1)
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

			const group_items_div = group_div.append('div').style('margin', '5px')
			// show categories from the group
			if (!group.type || group.type == 'values') addGroupItems(group_items_div, group.values)
			else if (group.type == 'filter') {
				if (!group.filter && self.term.groupsetting.lst[0].groups[i].filter4activeCohort) {
					const filter_ = self.term.groupsetting.lst[0].groups[i].filter4activeCohort[self.activeCohort]
					const filter = JSON.parse(JSON.stringify(filter_))

					// show filter for predefined tvslst for activeCohort
					filterInit({
						btn: group_items_div,
						btnLabel: 'Filter',
						emptyLabel: '+New Filter',
						holder: group_items_div.style('width', '320px'),
						vocab: self.vocab,
						callback: () => {}
					}).main(filter)
				}
			} else {
				throw 'group.values must be defined'
			}
		}

		// make draggable div to render drag-drop list of categories
		function initGroupDiv(args) {
			const { holder, group_name, group_i, group_type } = args
			const dragable_div = holder
				.append('div')
				.style('display', 'block')
				.style('padding', '10px')
				.style('vertical-align', 'top')

			if (group_type !== 'filter') {
				dragable_div
					.on('dragover', () => {
						if (group_i == drag_native_grp) {
							dragged_item
								.style('transition-property', 'background-color')
								.style('transition-duration', '1s')
								.style('background-color', '#eee')
							return
						}
						event.preventDefault()
						event.stopPropagation()
						dragable_div.style('background-color', group_i !== drag_native_grp ? '#cfe2f3' : '#fff')
					})
					.on('dragenter', () => {
						if (group_i == drag_native_grp) return
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
			}

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
						.style('color', count == 0 ? '#777' : 'black')
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
