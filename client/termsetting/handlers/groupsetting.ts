import { keyupEnter } from '#src/client'
import { select, selectAll, Selection } from 'd3-selection'
import { CategoricalTermSettingInstance, GroupSetInputValues } from '#shared/types/index'
import { Tabs } from '#dom/toggleButtons'
import { disappear } from '#src/client'
import { throwMsgWithFilePathAndFnName } from '#dom/sayerror'

/*
---------Exported---------
class GroupSettingMethods

Refactor notes/TODOs:
 - Items in a removed group is sent to excluded
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

type ItemEntry = {
	key: string
	label: string //Drag label
	group: number //Current group index for item. .group maybe calculated or returned from categorical.ts.
	count?: number | string //Sample count number or 'n/a'
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
	draggables: any
}
type GrpSetDom = {
	menuWrapper: HTMLElement
	actionDiv: HTMLElement
	grpsWrapper: HTMLElement
	includedWrapper: HTMLElement
	excludedWrapper: HTMLElement
}

type GroupSettingInstance = CategoricalTermSettingInstance //Will change to accommodate conditional termsetting later

export class GroupSettingMethods {
	opts: any
	dom: Partial<GrpSetDom>
	data: { groups: GrpEntry[]; values: ItemEntry[] }
	inputValues: any
	initGrpSetUI: any

	constructor(opts: GroupSettingInstance) {
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

	processInput(data: DataInput) {
		//add excluded categories, group 1, and group 2 indexes by default
		//these three groups should always appear in the menu
		const grpIdxes: Set<number> = new Set([0, 1, 2])
		const input = structuredClone(data)
		if (this.opts.q.groupsetting.customset) {
			//customset created when user applies groupsetting
			this.formatCustomset(grpIdxes, input)
		} else {
			for (const [k, v] of Object.entries(input)) {
				if (v.uncomputable) return
				if (v?.group > 4)
					throw `The maximum number of groups is 4. The group index for value = ${v.label} is ${v.group}`
				const value = {
					key: k,
					label: v.label,
					group: v.group || 1
				}
				this.data.values.push(value)
				grpIdxes.add(value.group)
			}
		}

		this.data.values.forEach(v => {
			//find sample counts for each value once added to array
			v.count = this.opts.category2samplecount
				? this.opts.category2samplecount.find((d: { key: string; count: number }) => d.key == v.key).count
				: 'n/a'
		})

		for (const g of Array.from(grpIdxes).sort((a, b) => a - b)) {
			//add any required groups, specifically exclude categories and group 2
			this.data.groups.push({
				currentIdx: g,
				type: 'values',
				name: g == 0 ? `Excluded categories` : g.toString()
			})
		}
	}

	formatCustomset(grpIdxes: Set<number>, input: DataInput) {
		//this might be overkill but need processing for non-categorical terms in the future
		for (const [i, group] of this.opts.q.groupsetting.customset.groups.entries()) {
			if (group.uncomputable) return
			this.data.groups.push({
				currentIdx: Number(i) + 1,
				type: 'values',
				name: group.name
			})
			grpIdxes.delete(i + 1)
			for (const value of group.values) {
				this.data.values.push({
					key: value.key,
					label: value.label,
					group: i + 1
				})
			}
		}
		if (this.data.values.length !== Object.keys(input).length) {
			//Find excluded values not returned in customset
			Object.entries(input)
				.filter((v: any) => !this.data.values.some(d => d.key == v[1].label))
				.forEach(v => {
					this.data.values.push({
						key: v[0],
						label: v[1].label,
						group: 0
					})
				})
		}
	}

	async main() {
		try {
			const input = this.opts.q.bar_by_children ? this.opts.term.subconditions : this.opts.term.values
			this.processInput(input)
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
		// 			label: 'Drag',
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
		// 			label: 'Text',
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
			.on('click', async () => {
				//cap the number of groups at 4, including excluded categories
				if (self.data.groups.length === 5) return

				self.data.groups.push({
					currentIdx: self.data.groups.length,
					name: self.data.groups.length.toString()
				})

				const group = self.data.groups[self.data.groups.length - 1]
				await initGroupDiv(group)
				self.update(group.currentIdx)
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
				self.opts.q.type = 'custom-groupset'
				self.opts.q.groupsetting = {
					inuse: true,
					customset: customset
				}
				self.opts.dom.tip.hide()
				self.opts.runCallback()
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
			.classed('sjpp-drag-drop-div', true) //unit testing
			.style('border', '1px solid #efefef')
			.style('display', 'block')
			.style('padding', '10px')
			.style('vertical-align', 'top')
			.each(async function (this: Element, group: GrpEntryWithDom) {
				group.wrapper = select(this)
				await initGroupDiv(group)
			})
	}

	let draggedItem: any
	// const dragTransfer = new DataTransfer()
	async function initGroupDiv(group: GrpEntryWithDom) {
		//Create the parent group div with user actions on the top
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
			group.dragActionDiv = group.wrapper.append('div').style('display', 'flex')
			group.input = group.dragActionDiv
				.append('input')
				.attr('size', 12)
				.attr('value', group.name)
				.style('margin', '5px')
				.style('margin-left', '8px')
				.style('display', 'inline-block')
				.style('font-size', '.8em')
				.style('width', '87%')
				.on('keyup', (event: KeyboardEvent) => {
					//Must hit enter to save. Problematic for UX?
					if (!keyupEnter(event)) return
					self.data.groups[group.currentIdx].name = group.input.node().value
				})
			group.destroyBtn = group.dragActionDiv
				.append('button')
				.style('display', 'inline-block')
				.style('padding', '0px 4px')
				.property('disabled', self.data.groups.length <= 3)
				.text('x')
				.on('click', async (event: MouseEvent) => {
					if (self.data.groups.length <= 3) return
					self.data.groups = self.data.groups.filter((d: GrpEntry) => d.currentIdx != group.currentIdx)
					await self.removeGroup(group)
				}) as Element
		}

		group.draggables = group.wrapper.append('div').classed('sjpp-drag-list-div', true)

		await self.addItems(group)
	}

	self.addItems = async function (group: GrpEntryWithDom) {
		await group.draggables
			//add draggable items to group div
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
			.style('color', (d: ItemEntry) => (d.count == 0 ? '#777' : 'black'))
			.html((d: ItemEntry) => d.label + (d.count !== undefined ? ' (n=' + d.count + ')' : ''))
			.style('background-color', '#eee')
			.each(function (this: Element, item: any, d: ItemEntry | number) {
				// d = self.data.values.find((v: ItemEntry, i: number) => i == d)
				const itemNode = select(this)
					.on('dragstart', function (event: DragEvent, d: any) {
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
			const defaultDuration = 1000
			await collapseAnimation(defaultDuration)
			for (const v of self.data.values) {
				if (v.group == group.currentIdx) v.group = 0
			}
			// setTimeout(() => {
			// 	disappear(group.wrapper, true)
			// }, defaultDuration * 3)
		}
		self.update(0)

		async function collapseAnimation(defaultDuration: number) {
			//Remove user action divs
			// group.title.remove()
			group.input.remove()
			group.destroyBtn.remove()
			group.wrapper.remove()

			// const z = self.dom.excludedWrapper.node().getBoundingClientRect()
			// const a = group.draggables.selectAll('.sjpp-drag-item')
			// a
			// .style('transform', `translate(${z.x}px, ${z.y}px)`)
			// .style('transtition', `transform ${defaultDuration}ms ease-in-out`)

			// a.transition().duration(defaultDuration).attr(`transform`, `translate(${z.x}, ${z.y})`)
			// const { x, y } = getCollapsedScale(self.dom.excludedWrapper.node(), group.wrapper.node())
			// console.log(x, y)
			// 	const collapsedX = 0
			// 	const collapsedY = 0

			// const collapseEffect = [
			// 	{ transform: 'none' },
			// 	// { transform: 'none', offset: 0.2 },
			// 	{ transform: `translate(${collapsedX}px, ${collapsedY}px)` }
			// ]

			// 	const collapseTime = {
			// 		duration: defaultDuration,
			// 		iterations: 1
			// 	}

			// 	await group.draggables.each(function (this: HTMLElement) {
			// 		const item = select(this).node()
			// 		if (!(item instanceof HTMLElement)) return
			// 		item.animate(collapseEffect, collapseTime)
			// 	})

			// 	const values2Exclude = self.data.values.filter((d: ItemEntry) => d.group == group.currentIdx)
			// 	values2Exclude.forEach((d: ItemEntry) => (d.group = 0))
			// 	// group.destroyBtn
			// 	// 	.style('padding', '5px')
			// 	// 	.text(itemsNum.length)
			// 	group.draggables.style('transform', `translate(${collapsedX}px, ${collapsedY}px) scale(0)`)
		}
	}

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
	// }

	self.update = async function (idx = 0) {
		self.data.groups.forEach((group: GrpEntry) => {
			if (group.currentIdx > idx && idx !== 0) {
				group.currentIdx = group.currentIdx - 1
			}
		})
		self.dom.grpsWrapper
			.selectAll('.sjpp-drag-drop-div')
			.data(self.data.groups)
			.each(async (group: GrpEntryWithDom) => {
				// group.title.text(group.currentIdx.toString() == group.name ? `Group ${group.currentIdx}` : group.name)
				if (group.currentIdx !== 0) {
					group.input.node().value = group.name
					group.destroyBtn.property('disabled', self.data.groups.length <= 3)
				}
				await self.addItems(group)
			})
	}
}
