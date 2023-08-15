import { keyupEnter } from '#src/client'
import { select, selectAll } from 'd3-selection'
import { CategoricalTermSettingInstance } from '#shared/types'
import { Tabs } from '#dom/toggleButtons'

/*
Refactor notes:
 - Rm 'number of groups' drop down
	- Replace with '+' or 'Add' button on the right and '-' or 'x' button to each group.
	- any group can be removed, provided >2 groups are present, except excluded categories
 - Items in a removed group is sent to excluded
	- keeps groups, specifically group 1, already defined 'clean' from removed items
	- visual reference items moved, such as a collapsed div with animation
 - Technical concerns: 
	- don't add to the app state - create a 'state' within
	- rm current exclude/include separation for adding items.
		- exclude is group 0; items added by isHidden
	- keep cap at 4

Future plans: 
	- Make available for subconditions, ie. condition terms
	- Toggle at the top: switch between drag UI and text UI
		- for long list of categories, create a text change with tab delimited UI
			0	Acute...
			1	Chronic...
			2	Diabetes...
			3	Other...
			User can simply change the group number. Switch back to the drag UI and see the updated list and change group names
		- maybe increase the cap? but only from this UI, not drag and drop
	- Spitball ideas: 
		- Hit enter required for group name change. Add visual cue group name changed, such as the green check mark or error-style message to hit enter. Maybe instruction are the top (excessive option)? 

*/

type ItemEntry = { label: string; group_idx: number; count: any }
type DataInput = { [index: string]: ItemEntry }
type GrpEntry = { currentIdx: number; name: string } //Scoped for file, maybe merge with GroupEntry type in future??
type GrpEntryWithDom = GrpEntry & {
	wrapper: any
	title: any
	destroyBtn: any
	input: any
	draggables: any
}
type GrpSetDom = {
	menuWrapper: HTMLElement
	actionDiv: HTMLElement
	grpsWrapper: HTMLElement
	includedWrapper: HTMLElement
	excludedWrapper: HTMLElement
}

export class GroupSettingMethods {
	opts: any
	dom: Partial<GrpSetDom>
	data: { groups: GrpEntry[]; values: ItemEntry[] }
	initGrpSetUI: any

	constructor(opts: CategoricalTermSettingInstance) {
		this.opts = opts
		// const menuWrapper = this.opts.dom.tip.d.append('div')
		// const actionDiv = menuWrapper.append('div')
		// const grpsWrapper = menuWrapper.append('div')
		this.dom = {
			// menuWrapper,
			// actionDiv,
			// grpsWrapper,
			// includedWrapper: grpsWrapper.append('div'),
			// excludedWrapper: grpsWrapper.append('div')
		}
		this.data = {
			groups: [],
			values: []
		}
		setRenderers(this)
	}

	async processInput(data: DataInput) {
		this.data.values = structuredClone(Object.values(data))
		//add excluded categories, group 1, and group 2 indexes by default
		//these three groups should always appear in the menu
		const grpIdxes: Set<number> = new Set([0, 1, 2])
		for (const d of this.data.values) {
			if (!d.group_idx) d.group_idx = 1 //default to group 1
			if (d.group_idx > 4)
				throw `The maximum number of groups is 4. The group index for value = ${d.label} is ${d.group_idx}`
			if (!d.count)
				d.count = this.opts.category2samplecount
					? this.opts.category2samplecount.find(v => v.key == d.label).count
					: 'n/a'

			grpIdxes.add(d.group_idx)
		}
		for (const g of Array.from(grpIdxes).sort((a, b) => a - b)) {
			this.data.groups.push({
				currentIdx: g,
				name: g == 0 ? `Excluded categories` : g.toString()
			})
		}
	}

	async main() {
		try {
			const input = this.opts.q.bar_by_children ? this.opts.term.subconditions : this.opts.term.values
			await this.processInput(input)
			this.initGrpSetUI()
		} catch (e: any) {
			if (e.stack) console.log(e.stack)
			else throw e
		}
	}
}

function setRenderers(self: any) {
	self.initGrpSetUI = function () {
		self.opts.dom.tip.clear().showunder(self.opts.dom.holder.node())
		// if (self.data.values.length > 10) {
		// 	//Tabs functionality for later - leave it for layout testing
		//	//TODO: move apply button up
		// 	const tabs = [
		// 		{
		// 			label: 'UI',
		// 			callback:  async (event, tab) => {
		// 				try {
		// 					self.opts.showDraggables()
		// 					delete tab.callback
		// 				} catch (e: any) {
		// 					if (e.stack) console.log(e.stack)
		// 					else throw e
		// 				}
		// 			}
		// 		},
		// 		{
		// 			label: 'Text Input',
		// 			callback: () => {console.log('Under Development')}
		// 		}
		// 	]

		// 	new Tabs({holder: self.dom.tip.d, tabs}).main()
		// } else {
		self.showDraggables()
		// }
	}
	self.showDraggables = async function () {
		self.dom.menuWrapper = self.opts.dom.tip.d.append('div')
		self.dom.actionDiv = self.dom.menuWrapper.append('div').attr('class', 'sjpp-group-actions').style('padding', '10px')

		//Add Group button
		self.dom.actionDiv
			.append('div')
			.attr('class', 'sjpp_apply_btn')
			.style('display', 'inline-block')
			.style('border-radius', '13px')
			.style('text-align', 'center')
			.style('font-size', '.8em')
			.style('text-transform', 'uppercase')
			.style('cursor', 'pointer')
			.text('Add Group')
			.on('click', () => {
				//cap the number of groups at 4, including excluded categories
				if (self.data.groups.length === 5) return

				self.data.groups.push({
					currentIdx: self.data.groups.length,
					name: self.data.groups.length.toString()
				})

				const group = self.data.groups[self.data.groups.length - 1]
				initGroupDiv(group)
			})

		//Apply button
		self.dom.actionDiv
			.append('div')
			.attr('class', 'sjpp_apply_btn sja_filter_tag_btn')
			.style('display', 'inline-block')
			.style('border-radius', '13px')
			.style('text-align', 'center')
			.style('font-size', '.8em')
			.style('float', 'right')
			.style('text-transform', 'uppercase')
			.style('cursor', 'pointer')
			.text('Apply')
			.on('click', () => {
				//submit
			})

		//Top message
		self.dom.menuWrapper
			.append('div')
			.style('margin', '5px 2px')
			.style('font-size', '.6em')
			.style('color', '#999')
			.text('Drag-and-drop to assign categories to groups.')

		self.dom.grpsWrapper = self.dom.menuWrapper.append('div').classed('sjpp-groups-wrapper', true)
		self.dom.includedWrapper = self.dom.grpsWrapper
			.append('div')
			.classed('sjpp-groups-include', true)
			.classed('sjpp-group-edit-div', true)
			.style('display', 'flex')
		self.dom.excludedWrapper = self.dom.grpsWrapper
			.append('div')
			.classed('sjpp-groups-exclude', true)
			.classed('sjpp-group-edit-div', true)

		await initGroupDiv(self.data.groups.find((d: GrpEntry) => d.currentIdx === 0))

		await self.dom.includedWrapper
			.selectAll('div')
			.data(self.data.groups.filter((d: GrpEntry) => d.currentIdx != 0))
			.enter()
			.append('div')
			.classed('sjpp-drag-drop-div', true) //unit testing
			.style('border', '1px solid #efefef')
			.style('display', 'block')
			.style('padding', '10px')
			.style('vertical-align', 'top')
			.each(async function (this: any, group: GrpEntryWithDom) {
				group.wrapper = select(this)
				await initGroupDiv(group)
			})

		self.update()
	}

	async function initGroupDiv(group: GrpEntryWithDom) {
		//Create the parent group div with user actions on the top
		const wrapper = group.currentIdx === 0 ? self.dom.excludedWrapper : self.dom.includedWrapper
		if (!group.wrapper)
			group.wrapper = wrapper
				.append('div')
				.classed('sjpp-drag-drop-div', true)
				.style('border', '1px solid #efefef')
				.style('display', 'block')
				.style('padding', '10px')
				.style('vertical-align', 'top')

		let draggedItem: any
		group.wrapper
			.on('drop', function (this: Element, event: DragEvent) {
				console.log(231, group.currentIdx, draggedItem.group_idx)
				if (group.currentIdx == draggedItem.group_idx) return
				else group.wrapper.appendChild(draggedItem.node())
				event.preventDefault()
			})
			//.on('dragover', function (this: Element, event: DragEvent) {

			// const draggedData = draggedItem.node().__data__
			// if (group.currentIdx == draggedData.group_idx) {
			// 	return draggedItem
			// 		.style('transition-property', 'background-color')
			// 		.style('transition-duration', '1s')
			// 		.style('background-color', '#eee')
			// }
			// event.preventDefault()
			// event.stopPropagation()
			// group.wrapper.style('background-color', group.currentIdx !== draggedData.group_idx ? '#cfe2f3' : '#fff')
			//})
			.on('dragenter', function (this: Element, event: DragEvent) {
				const draggedData = draggedItem?.node().__data__ || undefined
				event.preventDefault()
				event.stopPropagation()
				select(this).style('background-color', '#fff')
			})
			.on('dragleave', function (this: Element, event: DragEvent) {
				event.preventDefault()
				event.stopPropagation()
				select(this).style('background-color', '#fff')
			})
			.on('dragend', function (this: Element, event: DragEvent) {
				event.preventDefault()
				event.stopPropagation()
				select(this).style('background-color', '#fff')
			})

		group.title = group.wrapper
			.append('div')
			.style('display', 'inline-block')
			.style('padding', '3px 10px')
			.style('text-align', 'left')
			.style('font-size', '.6em')
			.style('text-transform', 'uppercase')
			.style('color', '#999')
			.text(group.currentIdx.toString() == group.name ? `Group ${group.currentIdx}` : group.name)

		if (group.currentIdx !== 0) {
			group.destroyBtn = group.wrapper
				.append('button')
				.style('float', 'right')
				.style('display', 'inline-block')
				.style('padding', '0px 4px')
				// .property('disabled', self.data.groups.length > 2 ? false : true)
				.text('x')
				.on('click', (event: MouseEvent) => {
					if (self.data.groups.length <= 3) return
					group.wrapper.remove()
					self.data.groups = self.data.groups.filter((d: GrpEntry) => d.currentIdx != group.currentIdx)
					self.update(group.currentIdx)
				}) as Element

			group.input = group.wrapper
				.append('input')
				.attr('size', 12)
				.attr('value', group.currentIdx.toString() == group.name ? group.name : group.currentIdx)
				.style('margin', '5px')
				.style('margin-left', '8px')
				.style('display', 'inline-block')
				.style('font-size', '.8em')
				.style('width', '87%')
				.on('keyup', (event: KeyboardEvent) => {
					//Must hit enter to save. Problematic for UX?
					if (!keyupEnter(event)) return
					group.name = group.input.node().value
				}) as HTMLInputElement
		}

		group.draggables = group.wrapper.append('div').classed('sjpp-drag-list-div', true)
		;(await group.draggables
			//add draggable items to group div
			.selectAll('div')
			.data(self.data.values.filter((d: ItemEntry) => d.group_idx == group.currentIdx))
			.enter()
			.append('div')
			.attr('draggable', 'true')
			.attr('class', 'sj-drag-item')
			.style('margin', '3px')
			.style('cursor', 'default')
			.style('padding', '3px 10px')
			.style('border-radius', '5px')
			.style('color', (d: ItemEntry) => (d.count == 0 ? '#777' : 'black'))
			.html((d: ItemEntry) => d.label + (d.count !== undefined ? ' (n=' + d.count + ')' : ''))
			.style('background-color', '#eee')
			.each(async function (this: any, item: any, d: any) {
				//console.log(self.data.values.find(v => v.group_idx == d))
				item = select(this)
					.on('mouseover', function (this: Element) {
						select(this).style('background-color', '#fff2cc')
					})
					.on('mouseout', function (this: Element) {
						select(this).style('background-color', '#eee')
					})
					.on('dragstart', function (this: Element) {
						select(this).style('background-color', '#fff2cc')
						draggedItem = item
					})
			})) as HTMLDivElement
	}

	self.update = function (idx: number) {
		self.data.groups.forEach((group: GrpEntry) => {
			if (group.currentIdx > idx) {
				group.currentIdx = group.currentIdx - 1
				group.name = (group.currentIdx + 1).toString() == group.name ? group.currentIdx.toString() : group.name
			}
		})
		self.dom.includedWrapper
			.selectAll('div')
			.data(self.data.groups.filter((d: GrpEntry) => d.currentIdx != 0))
			.each(async (group: GrpEntryWithDom) => {
				group.title.text(group.currentIdx.toString() == group.name ? `Group ${group.currentIdx}` : group.name)
				group.input.node().value = group.name
			})
	}
}

/*
**** OLD IMPLEMENTATION ****
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

// type KeyLabel = { key: string | number; label: string }
// type GroupArgs = { holder: any; name: string; group_idx: number; group_type?: string }

// export function setGroupsettingMethods(self: any) {
// 	self.regroupMenu = function (grp_count: number, temp_cat_grps: GroupSetEntry) {
// 		self.showDraggables(grp_count, temp_cat_grps)
// 	}

// 	self.showDraggables = function (grp_count: number, temp_cat_grps: GroupSetEntry) {
// 		//start with default 2 groups, extra groups can be added by user
// 		const default_grp_count = grp_count || 2
// 		type Values = TermValues | Subconditions
// 		const values: Values = self.q.bar_by_children ? self.term.subconditions : self.term.values
// 		type CategoricalGroups = GroupSetEntry | Values
// 		const cat_grps: CategoricalGroups = temp_cat_grps || JSON.parse(JSON.stringify(values))
// 		const default_1grp = [
// 			{
// 				type: 'values',
// 				values: Object.keys(values)
// 					.filter(key => {
// 						if (!values[key].uncomputable) return true
// 					})
// 					.map(key => {
// 						return { key, label: values[key].label }
// 					})
// 			}
// 		]
// 		const default_empty_group = { type: 'values', values: [] }
// 		const empty_groups = Array(default_grp_count - 1).fill(default_empty_group)
// 		const default_groupset = { groups: [...default_1grp, ...empty_groups] }
// 		const excluded_cats: KeyLabel[] = []
// 		// to not change background of native group, keep track of dragged items original group
// 		let drag_native_grp: number, dragged_item: any
// 		const grpsetting_flag = self.q && self.q.groupsetting && self.q.groupsetting.inuse
// 		const groupset =
// 			grpsetting_flag && self.q.groupsetting.predefined_groupset_idx != undefined
// 				? self.term.groupsetting.lst[self.q.groupsetting.predefined_groupset_idx]
// 				: self.q.groupsetting && self.q.groupsetting.customset
// 				? self.q.groupsetting.customset
// 				: default_groupset

// 		Object.keys(cat_grps).forEach(key => {
// 			if (cat_grps[key].group == 0 || (!grpsetting_flag && cat_grps[key].uncomputable == true))
// 				excluded_cats.push({ key, label: cat_grps[key].label })
// 		})

// 		//initiate empty customset
// 		const customset: any = { groups: [] }
// 		const group_names: (string | undefined)[] = []
// 		if (self.q.bar_by_grade) customset.is_grade = true
// 		else if (self.q.bar_by_children) customset.is_subcondition = true

// 		for (let i = 0; i < default_grp_count; i++) {
// 			let group_name: string | undefined =
// 				groupset && groupset.groups && groupset.groups[i] && groupset.groups[i].name
// 					? groupset.groups[i].name
// 					: undefined

// 			if (self.q.bar_by_grade && groupset && groupset.is_subcondition) group_name = undefined
// 			if (self.q.bar_by_children && groupset && groupset.is_grade) group_name = undefined

// 			group_names.push(group_name)

// 			customset.groups.push({
// 				values: [],
// 				name: group_name as string
// 			})
// 		}

// 		self.dom.tip.clear().showunder(self.dom.holder.node())

// 		const regroup_div = self.dom.tip.d.append('div').style('margin', '10px')

// 		const header_buttons_div = regroup_div
// 			.append('div')
// 			.attr('class', 'group_edit_div')
// 			.style('margin', '10px 5px 5px 5px')

// 		header_buttons_div.append('label').attr('for', 'grp_ct').style('display', 'inline-block').html('Number of groups')

// 		const group_ct_select = header_buttons_div
// 			.append('select')
// 			.style('margin-left', '15px')
// 			.style('margin-bottom', '7px')
// 			.property('disabled', self.q.mode == 'binary' || self.q.mode == 'cutoff' ? true : false)
// 			.on('change', () => {
// 				if (group_ct_select.node().value < default_grp_count) {
// 					const grp_diff = default_grp_count - group_ct_select.node().value
// 					for (const value of Object.values(cat_grps as CategoricalGroups)) {
// 						if (value?.uncomputable) continue
// 						if (value.group > group_ct_select.node().value) value.group = 1
// 					}
// 					self.regroupMenu(default_grp_count - grp_diff, cat_grps)
// 				} else if (group_ct_select.node().value > default_grp_count) {
// 					const grp_diff = group_ct_select.node().value - default_grp_count
// 					for (const value of Object.values(cat_grps as CategoricalGroups)) {
// 						if (value?.uncomputable) continue
// 						if (value.group) value.group = 1
// 					}
// 					self.regroupMenu(default_grp_count + grp_diff, cat_grps)
// 				}
// 			})

// 		for (let i = 1; i < default_grp_count + 2; i++)
// 			group_ct_select
// 				.append('option')
// 				.attr('value', i + 1)
// 				.html(i + 1)

// 		group_ct_select.node().value = default_grp_count

// 		// help note for user to drag-drop in first group
// 		regroup_div
// 			.append('div')
// 			.style('margin', '5px 2px')
// 			.style('font-size', '.6em')
// 			.style('color', '#999')
// 			.text('Drag-and-drop to assign categories to groups.')

// 		const groups_holder = regroup_div.append('div').style('border', '1px solid #efefef')

// 		const non_exclude_div = groups_holder.append('div').style('display', 'flex')

// 		for (let i = 0; i < default_grp_count; i++) {
// 			const group = groupset.groups[i] || default_empty_group
// 			addGroupHolder(group, i)
// 		}

// 		// add Div for exclude without group rename input
// 		const exclude_grp_args = {
// 			holder: groups_holder,
// 			name: 'Excluded categories',
// 			group_idx: 0
// 		}

// 		const exclude_div = initGroupDiv(exclude_grp_args)

// 		exclude_div.style('border-top', '1px solid #efefef').on('drop', () => {
// 			addOnDrop(exclude_list, 0)
// 		})

// 		const exclude_list = exclude_div.append('div').style('margin', '5px').classed('sjpp-drag-list-div', true) //For unit testing

// 		// show excluded categories
// 		addGroupItems(exclude_list, excluded_cats)

// 		// 'Apply' button
// 		header_buttons_div
// 			.append('div')
// 			.attr('class', 'sjpp_apply_btn sja_filter_tag_btn')
// 			.style('display', 'inline-block')
// 			.style('border-radius', '13px')
// 			.style('text-align', 'center')
// 			.style('font-size', '.8em')
// 			.style('float', 'right')
// 			.style('text-transform', 'uppercase')
// 			.style('cursor', 'pointer')
// 			.text('Apply')
// 			.on('click', () => {
// 				const name_inputs = groups_holder.node().querySelectorAll('input')
// 				//update customset and add to self.q
// 				for (const [key, val] of Object.entries(cat_grps as CategoricalGroups)) {
// 					const i = cat_grps[key].group - 1
// 					const group: GroupEntry = customset.groups[i]
// 					if (group) {
// 						group.name = name_inputs[i].value
// 						group.type = 'values'
// 						// for conditional terms, keys are string but digits, so check if it's parseInt(str)
// 						const key_ = typeof key == 'string' && !isNaN(parseInt(key)) ? parseInt(key) : key
// 						group.values.push({ key: key_, label: (val as KeyLabel).label })
// 					}
// 				}
// 				self.q.type = 'custom-groupset'
// 				self.q.groupsetting = {
// 					inuse: true,
// 					customset: customset
// 				}
// 				self.dom.tip.hide()
// 				self.runCallback()
// 			})

// 		// create holder for each group from groupset with group name input
// 		function addGroupHolder(group: GroupEntry, i: number) {
// 			const group_args = {
// 				holder: non_exclude_div,
// 				name: 'Group ' + (i + 1),
// 				group_idx: i + 1,
// 				group_type: group.type
// 			}
// 			const group_div = initGroupDiv(group_args)

// 			group_div.style('border-right', i < default_grp_count - 1 ? '1px solid #efefef' : '').on('drop', () => {
// 				addOnDrop(group_items_div, i + 1)
// 			})

// 			const group_rename_div = group_div.append('div').attr('class', 'group_edit_div')

// 			const group_name_input = group_rename_div
// 				.append('input')
// 				.attr('size', 12)
// 				.attr('value', group && group.name ? group.name : i + 1)
// 				.style('margin', '5px')
// 				.style('margin-left', '8px')
// 				.style('display', 'inline-block')
// 				.style('font-size', '.8em')
// 				.style('width', '87%')
// 				.on('keyup', (event: KeyboardEvent) => {
// 					if (!keyupEnter(event)) return

// 					customset.groups[i].name = group_name_input.node().value
// 					self.q.type = 'custom-groupset'
// 					self.q.groupsetting = {
// 						inuse: true,
// 						customset
// 					}
// 				})

// 			const group_items_div = group_div.append('div').style('margin', '5px').classed('sjpp-drag-list-div', true) //For unit testing
// 			// show categories from the group
// 			if (!group.type || group.type == 'values') addGroupItems(group_items_div, group.values)
// 			else if (group.type == 'filter') {
// 				if (!group.filter && self.term.groupsetting.lst[0].groups[i].filter4activeCohort) {
// 					const filter_ = self.term.groupsetting.lst[0].groups[i].filter4activeCohort[self.activeCohort]
// 					const filter = JSON.parse(JSON.stringify(filter_))

// 					// show filter for predefined tvslst for activeCohort
// 					filterInit({
// 						btn: group_items_div,
// 						btnLabel: 'Filter',
// 						emptyLabel: '+New Filter',
// 						holder: group_items_div.style('width', '320px'),
// 						vocab: self.vocab
// 						//callback: () => {},
// 					}).main(filter)
// 				}
// 			} else {
// 				throw 'group.values must be defined'
// 			}
// 		}

// 		// make draggable div to render drag-drop list of categories
// 		function initGroupDiv(args: GroupArgs) {
// 			const holder = args.holder,
// 				group_name = args.name,
// 				group_i = args.group_idx,
// 				group_type = args.group_type
// 			const dragable_div = holder
// 				.append('div')
// 				.style('display', 'block')
// 				.style('padding', '10px')
// 				.style('vertical-align', 'top')
// 				.classed('sjpp-drag-drop-div', true) //For unit testing

// 			if (group_type !== 'filter') {
// 				dragable_div
// 					.on('dragover', (event: DragEvent) => {
// 						if (group_i == drag_native_grp) {
// 							dragged_item
// 								.style('transition-property', 'background-color')
// 								.style('transition-duration', '1s')
// 								.style('background-color', '#eee')
// 							return
// 						}
// 						event.preventDefault()
// 						event.stopPropagation()
// 						dragable_div.style('background-color', group_i !== drag_native_grp ? '#cfe2f3' : '#fff')
// 					})
// 					.on('dragenter', (event: DragEvent) => {
// 						if (group_i == drag_native_grp) return
// 						event.preventDefault()
// 						event.stopPropagation()
// 						dragable_div.style('background-color', group_i !== drag_native_grp ? '#cfe2f3' : '#fff')
// 					})
// 					.on('dragleave', (event: DragEvent) => {
// 						event.preventDefault()
// 						event.stopPropagation()
// 						dragable_div.style('background-color', '#fff')
// 					})
// 					.on('dragend', (event: DragEvent) => {
// 						event.preventDefault()
// 						event.stopPropagation()
// 						dragable_div.style('background-color', '#fff')
// 					})
// 			}

// 			// group title
// 			dragable_div
// 				.append('div')
// 				.style('display', 'block')
// 				.style('padding', '3px 10px')
// 				.style('text-align', 'left')
// 				.style('font-size', '.6em')
// 				.style('text-transform', 'uppercase')
// 				.style('color', '#999')
// 				.text(group_name)

// 			return dragable_div
// 		}

// 		// make drag-drop list of categories
// 		function addGroupItems(list_holder: any, values: KeyLabel[]) {
// 			const group_items = list_holder.selectAll('div').data(values)
// 			group_items
// 				.enter()
// 				.append('div')
// 				.each(function (this: Element, val: KeyLabel) {
// 					if (cat_grps[val.key].group == undefined && !cat_grps[val.key].uncomputable) cat_grps[val.key].group = 1
// 					else if (cat_grps[val.key].group == undefined && cat_grps[val.key].uncomputable == true)
// 						cat_grps[val.key].group = 0
// 					const samplecount_obj = self.category2samplecount
// 						? self.category2samplecount.find(d => d.key == val.key)
// 						: 'n/a'
// 					const count =
// 						samplecount_obj !== undefined && samplecount_obj !== 'n/a'
// 							? samplecount_obj.count
// 							: samplecount_obj == undefined
// 							? 0
// 							: undefined

// 					const item = select(this)
// 						.attr('draggable', 'true')
// 						.attr('class', 'sj-drag-item')
// 						.style('margin', '3px')
// 						.style('cursor', 'default')
// 						.style('padding', '3px 10px')
// 						.style('border-radius', '5px')
// 						.style('color', count == 0 ? '#777' : 'black')
// 						.html((val.label ? val.label : val.key) + (count !== undefined ? ' (n=' + count + ')' : ''))
// 						.style('background-color', '#eee')
// 						.on('mouseover', () => {
// 							item.style('background-color', '#fff2cc')
// 						})
// 						.on('mouseout', () => {
// 							item.style('background-color', '#eee')
// 						})
// 						.on('dragstart', () => {
// 							item.style('background-color', '#fff2cc')
// 							// attach id to dom, which is used by drop div to grab this dropped dom by id
// 							dragged_item = item
// 							drag_native_grp = cat_grps[val.key].group
// 						})
// 				})
// 		}

// 		function addOnDrop(group_list: any, group_i: number) {
// 			// move dom from one group holder to another group holder
// 			// if .group is same as previous, return (don't move or reorder categories)
// 			const val = dragged_item._groups[0][0].__data__ // get data attached to dom
// 			if (cat_grps[val.key].group == group_i) return
// 			else group_list.node().appendChild(dragged_item.node())

// 			// add transition effect on dragged item background
// 			dragged_item
// 				.style('transition-property', 'background-color')
// 				.style('transition-duration', '1s')
// 				.style('background-color', '#fff2cc')

// 			// update metadata for the category list (.group = 1 or 2 ..)
// 			cat_grps[val.key].group = group_i // update .group value based on drop group holder
// 		}
// 	}
// }
