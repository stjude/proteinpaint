import { select, Selection } from 'd3-selection'
//import { Tabs } from '#dom/toggleButtons'
//import { disappear } from '#src/client'
import { throwMsgWithFilePathAndFnName } from '../../dom/sayerror'
import { debounce } from 'debounce'
import { mclass } from '../../shared/common'
import {
	TermSettingInstance,
	ValuesGroup,
	PredefinedGroupSettingQ,
	CustomGroupSettingQ,
	GroupSettingQ,
	GeneVariantBaseQ,
	GeneVariantTerm,
	MinBaseQ
} from '#types'

/*
---------Exported---------
class GroupSettingMethods

Refactor notes/TODOs:
 - Visual reference items moved, such as a collapsed div with animation

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
*/

type Opts = {
	holder?: HTMLElement // div holder for drag-and-drop
	hideApply?: boolean // whether to hide apply button
}
type TsInstance = TermSettingInstance & {
	q: MinBaseQ & GroupSettingQ
	category2samplecount: any
}
type ItemEntry = {
	key: number | string //key returned from vocab.getCategories()
	label: string //Text label of drag item
	group: number //Current group index for item.
	samplecount: number | string | null //Sample count number or 'n/a'
	uncomputable?: boolean
}
type DataInput = { [index: string]: ItemEntry }
type GrpEntry = {
	//Scoped for file, maybe merge with GroupEntry type in future??
	currentIdx: number //Current index of group
	type: 'values' //always 'values'. Possible this key/val no longer needed
	name: string //Mutable group name, default .currentIdx
}
type GrpEntryWithDom = GrpEntry & {
	wrapper: Selection<Element, any, any, any>
	dragActionDiv: any
	title: any
	destroyBtn: any
	input: any
	inputMessage: any
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
	tsInstance: TsInstance // termsetting instance
	opts: Opts //options for groupsetting
	dom: Partial<GrpSetDom> //main menu dom elements before drag and drop divs are added
	minGrpNum: number //minimum num of groups rendered (excluded categories + 2 groups)
	defaultMaxGrpNum: number //default cutoff for num of groups. Used to calculate the actual max group num later
	data: { groups: GrpEntry[]; values: ItemEntry[] }
	initGrpSetUI: any //func init for groupsetting UI

	constructor(tsInstance, opts: Opts = {}) {
		this.tsInstance = tsInstance
		this.opts = opts
		this.dom = {
			menuWrapper: opts.holder || tsInstance.dom.tip.d.append('div')
		}
		this.minGrpNum = 3
		this.defaultMaxGrpNum = 5
		this.data = { groups: [], values: [] }
		setRenderers(this)
	}

	processInput(data: DataInput) {
		// add excluded categories, group 1, and group 2 indexes by default
		// these three groups should always appear in the menu
		const grpIdxes: Set<number> = new Set([0, 1, 2])
		const input = structuredClone(data)
		if (this.tsInstance.q.type == 'values') {
			// q.type='values'
			// if group assignments are attached to values then use these assignments
			// otherwise group all values into a single group
			for (const v of Object.values(input)) {
				if (v.uncomputable) return //Still necessary? Possibly taken care of termdb route... somewhere
				if (v?.group > this.defaultMaxGrpNum)
					throwMsgWithFilePathAndFnName(
						`The maximum number of groups is ${this.defaultMaxGrpNum}. The group index for value = ${v.label} is ${v.group}`
					)
				const value = {
					key: v.key,
					label: v.label,
					group: v.group || 1,
					samplecount: v.samplecount
				}
				this.data.values.push(value)
				grpIdxes.add(value.group)
			}
		} else if (this.tsInstance.q.type == 'custom-groupset') {
			// q.type = 'custom-groupset'
			// user generated a custom groupset
			// returns found groups to data.groups and values for groups and excluded groups
			this.formatCustomset(grpIdxes, input)
		} else if (this.tsInstance.q.type == 'predefined-groupset') {
			// q.type = 'predefined-groupset'
			// use the predefined groupset specified by user
			if (this.tsInstance.term.type == 'geneVariant') {
				const q = this.tsInstance.q as GeneVariantBaseQ & PredefinedGroupSettingQ
				const term = this.tsInstance.term as GeneVariantTerm
				// @ts-expect-error, need to harmonize input data structure between dictionary and geneVariant terms
				const dt = input.find(i => i.dt == q.dt)
				const classes = dt.classes.byOrigin ? dt.classes.byOrigin[q.origin] : dt.classes
				const groupset = term.groupsetting.lst[q.predefined_groupset_idx]
				let computableGrpIdx = 0
				for (const g of groupset.groups) {
					const group = g as ValuesGroup
					const grpIdx = group.uncomputable ? 0 : ++computableGrpIdx
					this.data.groups.push({
						currentIdx: grpIdx,
						type: 'values',
						name: grpIdx === 0 ? 'Excluded categories' : group.name
					})
					grpIdxes.delete(grpIdx)
					for (const [key, samplecount] of Object.entries(classes)) {
						if (group.values.some(v => v.key == key)) {
							this.data.values.push({
								key,
								label: mclass[key].label,
								group: grpIdx,
								// @ts-expect-error, will resolve when input data structure is harmonized (see above)
								samplecount
							})
						}
					}
				}
			}
		} else {
			throw 'q.type not recognized'
		}

		if (this.data.values.length == 0) throwMsgWithFilePathAndFnName(`Missing values`)

		// re-populate missing sample counts, which can occur
		// for a custom groupset
		this.data.values.forEach(v => {
			if (!v.samplecount) {
				if (this.tsInstance.term.type == 'geneVariant') {
					const q = this.tsInstance.q as GeneVariantBaseQ
					const dt = this.tsInstance.category2samplecount.find(i => i.dt == q.dt)
					const classes = dt.classes.byOrigin && q.origin ? dt.classes.byOrigin[q.origin] : dt.classes
					v.samplecount = classes[v.key]
				} else {
					v.samplecount = this.tsInstance.category2samplecount
						? this.tsInstance.category2samplecount.find(
								(d: { key: string; label?: string; samplecount: number }) => d.key == v.key
						  )?.samplecount
						: 'n/a'
				}
			}
		})

		for (const g of Array.from(grpIdxes)) {
			//add any required groups, specifically Excluded Categories and Group 2
			this.data.groups.push({
				currentIdx: g,
				type: 'values',
				name: g === 0 ? `Excluded categories` : `Group ${g.toString()}`
			})
		}
		this.data.groups.sort((a: GrpEntry, b: GrpEntry) => a.currentIdx - b.currentIdx)
	}

	formatCustomset(grpIdxes: Set<number>, input: DataInput) {
		const q = this.tsInstance.q as CustomGroupSettingQ
		for (const [i, g] of q.customset.groups.entries()) {
			const group = g as ValuesGroup
			if (group.uncomputable) return
			this.data.groups.push({
				currentIdx: Number(i) + 1,
				type: 'values',
				name: group.name
			})
			grpIdxes.delete(i + 1)
			for (const value of group.values) {
				/** label may not be provided in groupsetting.customset.
				 * If missing, find the label from category2samplecout or
				 * use the last ditch effort to use the key.
				 */
				const label = value.label
					? value.label
					: this.tsInstance.category2samplecount
					? this.tsInstance.category2samplecount.find(
							(d: { key: string; label?: string; samplecount: number }) => d.key == value.key
					  )?.label
					: value.key
				this.data.values.push({
					key: value.key,
					label: label,
					group: i + 1,
					samplecount: null
				})
			}
		}

		//Find excluded values not returned in customset
		if (this.tsInstance.term.type == 'geneVariant') {
			const q = this.tsInstance.q as GeneVariantBaseQ
			const dt = this.tsInstance.category2samplecount.find(i => i.dt == q.dt)
			const classes = dt.classes.byOrigin && q.origin ? dt.classes.byOrigin[q.origin] : dt.classes
			if (this.data.values.length !== Object.keys(classes).length) {
				for (const [key, samplecount] of Object.entries(classes)) {
					if (!this.data.values.some(d => d.key == key)) {
						this.data.values.push({
							key,
							label: mclass[key].label,
							group: 0,
							// @ts-expect-error, will resolve when input data structure is harmonized (see above)
							samplecount
						})
					}
				}
			}
		} else if (
			this.data.values.length !== Object.keys(input).length &&
			this.tsInstance.q.type != 'predefined-groupset' &&
			this.tsInstance.q.type != 'custom-groupset'
		) {
			Object.entries(input)
				.filter((v: any) => !this.data.values.some(d => d.key == v[1].label))
				.forEach(v => {
					this.data.values.push({
						key: v[0],
						label: v[1].label,
						group: 0,
						samplecount: this.tsInstance.category2samplecount
							? this.tsInstance.category2samplecount.find(
									(d: { key: string; label?: string; samplecount: number }) => d.key == v[0]
							  )?.samplecount
							: 'n/a'
					})
				})
		} else if (this.data.values.length !== this.tsInstance.category2samplecount.length) {
			this.tsInstance.category2samplecount
				.filter((v: ItemEntry) => !this.data.values.some(d => d.key == v.key))
				.forEach((v: ItemEntry) => {
					this.data.values.push({
						key: v.key,
						label: v.label,
						group: 0,
						samplecount: v.samplecount
					})
				})
		}
	}

	async main() {
		try {
			const input =
				(this.tsInstance.q.type == 'custom-groupset' && this.tsInstance.q.customset) ||
				this.tsInstance.category2samplecount ||
				this.tsInstance.term.values
			this.processInput(input)
			await this.initGrpSetUI()
		} catch (e: any) {
			if (e.stack) console.log(e.stack)
			else throwMsgWithFilePathAndFnName(e)
		}
	}
}

function setRenderers(self: any) {
	self.initGrpSetUI = async function () {
		/*max num of groups rendered + excluded categories
		Only allow adding the max feasible groups with cutoff of 5 + excluded categories*/
		self.maxGrpNum =
			self.data.values.length >= self.defaultMaxGrpNum ? self.defaultMaxGrpNum + 1 : self.data.values.length
		self.tsInstance.dom.tip.showunder(self.tsInstance.dom.holder.node())
		// if (self.data.values.length > 10) {
		// 	//Tabs functionality for later - leave it for layout testing
		//	//TODO: move apply button up
		// 	const tabs = [
		// 		{
		// 			label: 'Drag',
		// 			callback:  async (event, tab) => {
		// 				try {
		// 					self.tsInstance.showDraggables()
		// 					delete tab.callback
		// 				} catch (e: any) {
		// 					if (e.stack) console.log(e.stack)
		// 					else throw e
		// 				}
		// 			}
		// 		},
		// 		{
		// 			label: 'Text',
		// 			callback: () => {console.log('Under Development')}
		// 		}
		// 	]

		// 	new Tabs({holder: self.dom.tip.d, tabs}).main()
		// } else {
		await self.showDraggables()
		// }
	}
	self.showDraggables = async function () {
		self.dom.actionDiv = self.dom.menuWrapper.append('div').attr('class', 'sjpp-group-actions').style('padding', '10px')

		/*A goal when refactoring groupsetting was to ~not~ attach any variable or 
		function to the termsetting instance. Must find all previous `New Group #`s 
		and create a counter.*/
		const findNewGrps = self.data.groups.filter((g: GrpEntryWithDom) => g.name.startsWith('New Group'))
		let newGrpNum = findNewGrps.length > 0 ? findNewGrps[findNewGrps.length - 1].name.replace(`New Group `, '') : 0

		//Add Group button
		self.dom.actionDiv.addGroup = self.dom.actionDiv
			.append('button')
			.classed('sjpp_grpset_addGrp_btn', true) //for integration testing
			.style('display', 'inline-block')
			.style('text-align', 'center')
			.style('cursor', self.tsInstance.q.mode == 'binary' ? 'default' : 'pointer')
			.property('disabled', self.tsInstance.q.mode == 'binary' ? true : self.data.groups.length >= self.maxGrpNum)
			.text('Add Group')
			.on('click', async () => {
				newGrpNum++
				self.data.groups.push({
					currentIdx: self.data.groups.length,
					type: 'values',
					name: `New Group${newGrpNum != 1 ? ` ${newGrpNum}` : ''}`
				})
				const group = self.data.groups[self.data.groups.length - 1]
				await initGroupDiv(group)
				await self.update()
			})

		//Apply button
		self.dom.actionDiv.applyBtn = self.dom.actionDiv
			.append('button')
			.classed('sjpp_grpset_apply_btn', true) //for integration testing
			.style('display', self.opts.hideApply ? 'none' : 'inline-block')
			.style('text-align', 'center')
			.style('float', 'right')
			.style('cursor', 'pointer')
			.text('Apply')
			.on('click', () => {
				self.processDraggables()
				self.tsInstance.dom.tip.hide()
				self.tsInstance.runCallback()
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
			.classed('sjpp-drag-drop-div', true)

		await initGroupDiv(self.data.groups.find((d: GrpEntry) => d.currentIdx === 0))

		await self.dom.includedWrapper
			.selectAll('div')
			.data(self.data.groups.filter((d: GrpEntry) => d.currentIdx != 0))
			.enter()
			.append('div')
			.classed('sjpp-drag-drop-div', true) //for unit testing
			.style('border', '1px solid #efefef')
			.style('display', 'block')
			.style('padding', '10px')
			.style('vertical-align', 'top')
			.each(async function (this: Element, group: GrpEntryWithDom) {
				group.wrapper = select(this)
				await initGroupDiv(group)
			})
	}

	self.processDraggables = () => {
		if (!draggedItem && !editedName) return // no groupset changes, so return
		const customset: any = { groups: [] }
		for (const group of self.data.groups) {
			if (group.currentIdx === 0) continue
			const groupValues = self.data.values
				.filter((v: ItemEntry) => v.group == group.currentIdx)
				.map((v: ItemEntry) => {
					return { key: v.key, label: v.label }
				})
			if (groupValues.length == 0) continue
			customset.groups.push({
				name: group.name,
				type: group.type,
				values: groupValues
			})
		}
		self.tsInstance.q.type = 'custom-groupset'
		self.tsInstance.q.customset = customset
		delete self.tsInstance.q.predefined_groupset_idx
	}

	let draggedItem: any
	let editedName: boolean
	async function initGroupDiv(group: GrpEntryWithDom) {
		//Create the parent group div on load and with user actions on the top
		const wrapper = group.currentIdx === 0 ? self.dom.excludedWrapper : self.dom.includedWrapper
		group.type = 'values'
		if (!group.wrapper)
			group.wrapper = wrapper
				.append('div')
				.classed('sjpp-drag-drop-div', true)
				.style('border', '1px solid #efefef')
				.style('display', 'block')
				.style('padding', '10px')
				.style('vertical-align', 'top')

		group.wrapper
			.on('drop', function (event: DragEvent) {
				const itemData = draggedItem.node().__data__
				if (itemData.group === group.currentIdx) return
				group.draggables.node().appendChild(draggedItem.node())

				draggedItem
					.style('transition-property', 'background-color')
					.style('transition-duration', '1s')
					.style('background-color', '#fff2cc')

				self.data.values.find((v: ItemEntry) => v === itemData).group = group.currentIdx

				event.preventDefault()
				event.stopPropagation()
			})
			.on('dragleave', function (event: DragEvent) {
				event.preventDefault()
				event.stopPropagation()
				group.wrapper.style('background-color', '#fff')
			})
			.on('dragend', function (event: DragEvent) {
				event.preventDefault()
				event.stopPropagation()
				group.wrapper.style('background-color', '#fff')
			})
			.on('dragover', function (event: DragEvent) {
				event.preventDefault()
				event.stopPropagation()
				group.wrapper.style(
					'background-color',
					group.currentIdx !== draggedItem.node().__data__.group ? '#cfe2f3' : '#fff'
				)
			})
			.on('dragenter', function (event: DragEvent) {
				if (draggedItem.node().__data__.group === group.currentIdx) return
				event.preventDefault()
				event.stopPropagation()
				group.wrapper.style(
					'background-color',
					group.currentIdx !== draggedItem.node().__data__.group ? '#cfe2f3' : '#fff'
				)
			})

		if (group.currentIdx === 0) {
			group.title = group.wrapper
				.append('div')
				.style('display', 'inline-block')
				.style('padding', '3px 10px')
				.style('text-align', 'left')
				.style('font-size', '.6em')
				.style('text-transform', 'uppercase')
				.style('color', '#999')
				.text(group.name)
		} else {
			group.dragActionDiv = group.wrapper.append('div').style('display', 'flex').style('align-items', 'center')
			group.input = group.dragActionDiv
				.append('input')
				.attr('size', 12)
				.attr('value', group.name)
				.style('margin', '5px')
				.style('margin-left', '8px')
				.style('display', 'inline-block')
				.style('font-size', '.8em')
				.style('width', '87%')
				.on('keyup', () => {
					debounce(self.onKeyUp(group), 1000)
				})

			group.inputMessage = group.dragActionDiv
				.append('span')
				.style('color', 'red')
				.style('font-size', '0.7em')
				.text('NOT unique')
				.style('display', 'none')

			group.destroyBtn = group.dragActionDiv
				.append('button')
				.style('display', 'inline-block')
				.style('padding', '0px 4px')
				.property('disabled', self.data.groups.length <= self.minGrpNum) //Each appears disabled/enabled based on the number of groups
				.text('x')
				.on('click', async () => {
					if (self.data.groups.length <= self.minGrpNum) return
					self.data.groups = self.data.groups.filter((d: GrpEntry) => d.currentIdx != group.currentIdx)
					await self.removeGroup(group)
				}) as Element
		}

		group.draggables = group.wrapper.append('div').classed('sjpp-drag-list-div', true)

		await self.addItems(group)
	}

	self.onKeyUp = async function (group: GrpEntryWithDom) {
		//Detect unique name on change. If not a unique name, alert the user and disable apply button
		if (group.name == group.input.node().value) return
		editedName = true
		const match = self.data.groups.filter((g: GrpEntryWithDom) => g.name == group.input.node().value)
		if (match.length > 0) {
			self.dom.actionDiv.applyBtn.property('disabled', true)
			group.inputMessage.style('display', 'block')
		} else {
			self.dom.actionDiv.applyBtn.property('disabled', false)
			group.inputMessage.style('display', 'none')
			self.data.groups[group.currentIdx].name = group.input.node().value.trim()
		}
	}

	self.addItems = async function (group: GrpEntryWithDom) {
		//add draggable items to group div
		await group.draggables
			.selectAll('div')
			.data(self.data.values.filter((d: ItemEntry) => d.group == group.currentIdx))
			.enter()
			.append('div')
			.attr('draggable', 'true')
			.attr('class', 'sjpp-drag-item')
			.style('margin', '3px')
			.style('cursor', 'default')
			.style('padding', '3px 10px')
			.style('border-radius', '5px')
			.style('color', (d: ItemEntry) => (d.samplecount == 0 ? '#777' : 'black'))
			.text((d: ItemEntry) => `${d.label}${d.samplecount !== undefined ? ` (n=${d.samplecount})` : ''}`)
			.style('background-color', '#eee')
			.each(function (this: Element) {
				const itemNode = select(this)
					.on('dragstart', function () {
						itemNode.style('background-color', '#fff2cc')
						draggedItem = itemNode
					})
					.on('mouseenter', function () {
						itemNode.style('background-color', '#fff2cc')
					})
					.on('mouseleave', function () {
						itemNode.style('background-color', '#eee')
					})
			})
	}

	self.removeGroup = async function (group: GrpEntryWithDom) {
		const itemsNum = group.wrapper.selectAll('.sjpp-drag-item').nodes()
		if (itemsNum.length === 0) group.wrapper.remove()
		else {
			group.input.remove()
			group.destroyBtn.remove()
			group.wrapper.remove()
			for (const v of self.data.values) {
				//Reassign all values to excluded categories group
				if (v.group == group.currentIdx) v.group = 0
			}
			// setTimeout(() => {
			// 	disappear(group.wrapper, true)
			// }, defaultDuration * 3)
		}
		await self.update()

		// async function collapseAnimation(defaultDuration: number) {
		// 	//Remove user action divs
		// 	group.input.remove()
		// 	group.destroyBtn.remove()
		// 	group.wrapper.remove()

		// 		// const z = self.dom.excludedWrapper.node().getBoundingClientRect()
		// 		// const a = group.draggables.selectAll('.sjpp-drag-item')
		// 		// a
		// 		// .style('transform', `translate(${z.x}px, ${z.y}px)`)
		// 		// .style('transtition', `transform ${defaultDuration}ms ease-in-out`)

		// 		// a.transition().duration(defaultDuration).attr(`transform`, `translate(${z.x}, ${z.y})`)
		// 		// const { x, y } = getCollapsedScale(self.dom.excludedWrapper.node(), group.wrapper.node())
		// 		// console.log(x, y)
		// 		// 	const collapsedX = 0
		// 		// 	const collapsedY = 0

		// 		// const collapseEffect = [
		// 		// 	{ transform: 'none' },
		// 		// 	// { transform: 'none', offset: 0.2 },
		// 		// 	{ transform: `translate(${collapsedX}px, ${collapsedY}px)` }
		// 		// ]

		// 		// 	const collapseTime = {
		// 		// 		duration: defaultDuration,
		// 		// 		iterations: 1
		// 		// 	}

		// 		// 	await group.draggables.each(function (this: HTMLElement) {
		// 		// 		const item = select(this).node()
		// 		// 		if (!(item instanceof HTMLElement)) return
		// 		// 		item.animate(collapseEffect, collapseTime)
		// 		// 	})

		// 		// 	const values2Exclude = self.data.values.filter((d: ItemEntry) => d.group == group.currentIdx)
		// 		// 	values2Exclude.forEach((d: ItemEntry) => (d.group = 0))
		// 		// 	// group.destroyBtn
		// 		// 	// 	.style('padding', '5px')
		// 		// 	// 	.text(itemsNum.length)
		// 		// 	group.draggables.style('transform', `translate(${collapsedX}px, ${collapsedY}px) scale(0)`)
		// 	}
		// }

		// function getCollapsedScale(anchor: any, div: Element) {
		// 	//anchor: constant element appearing on expand and collapse
		// 	//div: the whole div, items and all, to collapse and expand
		// 	const collapsed = anchor.getBoundingClientRect()
		// 	const expanded = div.getBoundingClientRect()
		// 	console.log(collapsed, expanded)
		// 	return{ x: 0, y: 0}
		// 	// return {
		// 	// 	x: collapsed.width / expanded.width,
		// 	// 	y: collapsed.height / expanded.height
		// 	// }
	}

	self.update = async function () {
		self.dom.actionDiv.addGroup.property('disabled', self.data.groups.length >= self.maxGrpNum)
		for (const [i, grp] of self.data.groups.entries()) {
			if (i === 0) continue
			if (grp.currentIdx != i) {
				self.data.values.filter((v: ItemEntry) => v.group == grp.currentIdx).forEach((v: ItemEntry) => (v.group = i))
				grp.currentIdx = i
			}
		}
		self.dom.grpsWrapper
			.selectAll('.sjpp-drag-drop-div')
			.data(self.data.groups)
			.each(async (group: GrpEntryWithDom) => {
				if (group.currentIdx !== 0) {
					group.input.node().value = group.name
					group.destroyBtn.property('disabled', self.data.groups.length <= self.minGrpNum)
				}
				await self.addItems(group)
			})
	}
}
