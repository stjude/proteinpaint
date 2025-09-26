import { HandlerBase } from '../HandlerBase.ts'
import type { Handler } from '../index.ts'
import type { QualValues, QualPredefinedGS, QualCustomGS } from '#tw'
import { select, type Selection } from 'd3-selection'
import type { TermSetting } from '../TermSetting.ts'
import { debounce } from 'debounce'

type SampleCountEntry = {
	key: number | string //key returned from vocab.getCategories()
	label: string //Text label of drag item
	group: number //Current group index for item.
	samplecount: number | string | null //Sample count number or 'n/a'
	uncomputable?: boolean
}
// type DataInput = { [index: string]: SampleCountEntry }

type GrpEntry = {
	//Scoped for file, maybe merge with GroupEntry type in future??
	currentIdx: number //Current index of group
	type: string //'values' | 'filter'
	name: string //Mutable group name, default .currentIdx
	uncomputable?: boolean
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

// type GrpSetDom = {
// 	menuWrapper: HTMLElement
// 	actionDiv: HTMLElement
// 	grpsWrapper: HTMLElement
// 	includedWrapper: HTMLElement
// 	excludedWrapper: HTMLElement
// }

export class GroupSet extends HandlerBase implements Handler {
	tw: QualValues | QualPredefinedGS | QualCustomGS
	termsetting: TermSetting
	category2samplecount: any
	defaultMaxGrpNum = 5
	minGrpNum = 3
	maxGrpNum!: number
	data!: any //{groups: any[], values: any[]}
	dom: {
		[name: string]: any
	} = {} //main menu dom elements before drag and drop divs are added
	draggedItem: any
	removedGrp: any
	editedName: any

	constructor(opts) {
		super(opts)
		this.termsetting = opts.termsetting
		this.tw = opts.termsetting.tw
		this.dom.holder = opts.holder || this.termsetting.dom.tip.d
		this.data = { groups: [], values: [], filters: [] }
	}

	getPillStatus() {
		return this.tw.getStatus(this.termsetting.usecase)
	}

	async showEditMenu() {
		const self = this.termsetting
		const holder = this.dom.holder
		this.dom.loadingDiv = holder
			.append('div')
			.style('margin', '10px')
			.style('padding', '10px')
			.text('Getting categories...')
		this.dom.menuWrapper = holder.append('div')

		//for rendering groupsetting menu
		const body = self.opts.getBodyParams?.() || {}
		this.dom.loadingDiv.style('display', 'block')
		const data = await self.vocabApi.getCategories(self.term, self.filter, body)
		this.dom.loadingDiv.style('display', 'none')
		/** Original code created a separate array (self.category2samplecount) and pushed only the key and label.
		 * The new self.category2samplecount was used to create the groupsetting menu items. That logic was removed
		 * as groupsetting.ts handles formating the data. However category2samplecount = [] is still used
		 * in other client side code. The data shape may differ until all the code is refactored.
		 */
		this.category2samplecount = data.lst
		this.data = this.tw.getGroups(this.category2samplecount)
		await this.initGrpSetUI()
	}

	async initGrpSetUI() {
		const self = this.termsetting
		/*max num of groups rendered + excluded categories
			Only allow adding the max feasible groups with cutoff of 5 + excluded categories*/
		this.maxGrpNum =
			this.data.values.length >= this.defaultMaxGrpNum ? this.defaultMaxGrpNum + 1 : this.data.values.length

		self.dom.tip.showunder(self.dom.holder.node())
		await this.showDraggables()
	}

	async showDraggables() {
		const self = this.termsetting
		//this.dom.menuWrapper.selectAll('*').remove()
		this.dom.menuWrapper.style('padding', '10px')
		this.dom.actionDiv = this.dom.menuWrapper
			.append('div')
			.attr('class', 'sjpp-group-actions')
			.style('padding', '0px 10px 10px 0px')

		/*A goal when refactoring groupsetting was to ~not~ attach any variable or 
		function to the termsetting instance. Must find all previous `New Group #`s 
		and create a counter.*/
		const findNewGrps = this.data.groups.filter((g: GrpEntryWithDom) => g.name.startsWith('New Group'))
		let newGrpNum = findNewGrps.length > 0 ? findNewGrps[findNewGrps.length - 1].name.replace(`New Group `, '') : 0

		const q = this.tw.q

		//Add Group button
		this.dom.actionDiv.addGroup = this.dom.actionDiv
			.append('button')
			.classed('sjpp_grpset_addGrp_btn', true) //for integration testing
			.style('display', 'inline-block')
			.style('text-align', 'center')
			.style('cursor', q.mode == 'binary' ? 'default' : 'pointer')
			.property('disabled', q.mode == 'binary' ? true : this.data.groups.length >= this.maxGrpNum)
			.text('Add Group')
			.on('click', async () => {
				newGrpNum++
				this.data.groups.push({
					currentIdx: this.data.groups.length,
					type: 'value',
					name: `New Group${newGrpNum != 1 ? ` ${newGrpNum}` : ''}`
				})
				const group = this.data.groups[this.data.groups.length - 1]
				await this.initGroupDiv(group)
				await this.update()
			})

		//Apply button
		this.dom.actionDiv.applyBtn = this.dom.actionDiv
			.append('button')
			.classed('sjpp_grpset_apply_btn', true) //for integration testing
			.style('display', self.opts.hideApply ? 'none' : 'inline-block')
			.style('text-align', 'center')
			.style('float', 'right')
			.style('cursor', 'pointer')
			.text('Apply')
			.on('click', () => {
				this.processDraggables()
				self.dom.tip.hide()
				self.api.runCallback()
			})

		//Top message
		this.dom.menuWrapper
			.append('div')
			.style('display', 'block')
			.style('margin', '5px 2px')
			.style('font-size', '.6em')
			.style('color', '#999')
			.text('Drag-and-drop to assign categories to groups.')

		this.dom.grpsWrapper = this.dom.menuWrapper.append('div').classed('sjpp-groups-wrapper', true)
		this.dom.includedWrapper = this.dom.grpsWrapper
			.append('div')
			.classed('sjpp-groups-include', true)
			.classed('sjpp-group-edit-div', true)
			.style('display', 'flex')
		this.dom.excludedWrapper = this.dom.grpsWrapper
			.append('div')
			.classed('sjpp-groups-exclude', true)
			.classed('sjpp-group-edit-div', true)
			.classed('sjpp-drag-drop-div', true)

		const excludedGroup = this.data.groups.find((d: GrpEntry) => d.currentIdx === 0)
		delete excludedGroup.wrapper // excludedGroup will not get displayed by initGroupDiv() if .wrapper present
		await this.initGroupDiv(excludedGroup)

		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const handler = this
		await this.dom.includedWrapper
			.selectAll('div')
			.data(this.data.groups.filter((d: GrpEntry) => d.currentIdx != 0))
			.enter()
			.append('div')
			.classed('sjpp-drag-drop-div', true) //for unit testing
			.style('border', '1px solid #efefef')
			.style('display', 'block')
			.style('padding', '10px')
			.style('vertical-align', 'top')
			.each(async function (this: Element, group: GrpEntryWithDom) {
				group.wrapper = select(this)
				await handler.initGroupDiv(group)
			})
	}

	processDraggables() {
		const self = this.termsetting
		const editedGrpset = this.draggedItem || this.editedName || this.removedGrp
		if (!editedGrpset) return // no groupset changes, so return
		const customset: any = { groups: [] }
		for (const group of this.data.groups) {
			// TODO: generalize group.type expectation
			if (group.type != 'values' && group.type != 'QualTWValues' && group.type != 'QualTWValues')
				throw `group.type='${group.type}' is not recognized`
			const customgroup: any = { name: group.name, type: 'values', uncomputable: group.uncomputable }
			const groupValues = this.data.values
				.filter((v: SampleCountEntry) => v.group == group.currentIdx)
				.map((v: SampleCountEntry) => {
					return { key: v.key, label: v.label, samplecount: v.samplecount }
				})
			customgroup.values = groupValues
			customset.groups.push(customgroup)
		}
		self.q = {
			type: 'custom-groupset',
			customset
		}
	}

	async initGroupDiv(group: GrpEntryWithDom) {
		//Create the parent group div on load and with user actions on the top
		const wrapper = group.currentIdx === 0 ? this.dom.excludedWrapper : this.dom.includedWrapper
		if (!group.type) group.type = 'values'
		if (!group.wrapper)
			group.wrapper = wrapper
				.append('div')
				.classed('sjpp-drag-drop-div', true)
				.style('border', '1px solid #efefef')
				.style('display', 'block')
				.style('padding', '10px')
				.style('vertical-align', 'top')

		group.wrapper
			.on('drop', (event: DragEvent) => {
				const itemData = this.draggedItem.node().__data__
				if (itemData.group === group.currentIdx) return
				group.draggables.node().appendChild(this.draggedItem.node())

				this.draggedItem
					.style('transition-property', 'background-color')
					.style('transition-duration', '1s')
					.style('background-color', '#fff2cc')

				this.data.values.find((v: SampleCountEntry) => v === itemData).group = group.currentIdx

				event.preventDefault()
				event.stopPropagation()
			})
			.on('dragleave', (event: DragEvent) => {
				event.preventDefault()
				event.stopPropagation()
				group.wrapper.style('background-color', '#fff')
			})
			.on('dragend', (event: DragEvent) => {
				event.preventDefault()
				event.stopPropagation()
				group.wrapper.style('background-color', '#fff')
			})
			.on('dragover', (event: DragEvent) => {
				event.preventDefault()
				event.stopPropagation()
				group.wrapper.style(
					'background-color',
					group.currentIdx !== this.draggedItem.node().__data__.group ? '#cfe2f3' : '#fff'
				)
			})
			.on('dragenter', (event: DragEvent) => {
				if (this.draggedItem.node().__data__.group === group.currentIdx) return
				event.preventDefault()
				event.stopPropagation()
				group.wrapper.style(
					'background-color',
					group.currentIdx !== this.draggedItem.node().__data__.group ? '#cfe2f3' : '#fff'
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
					debounce(this.onKeyUp(group), 1000)
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
				.property('disabled', this.data.groups.length <= this.minGrpNum) //Each appears disabled/enabled based on the number of groups
				.text('x')
				.on('click', async () => {
					if (this.data.groups.length <= this.minGrpNum) return
					this.data.groups = this.data.groups.filter((d: GrpEntry) => d.currentIdx != group.currentIdx)
					await this.removeGroup(group)
				}) as Element
		}

		group.draggables = group.wrapper.append('div').classed('sjpp-drag-list-div', true)
		await this.addItems(group)
	}

	async addItems(group: GrpEntryWithDom) {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const handler = this
		//add draggable items to group div
		await group.draggables
			.selectAll('div')
			.data(this.data.values.filter((d: SampleCountEntry) => d.group == group.currentIdx))
			.enter()
			.append('div')
			.attr('draggable', 'true')
			.attr('class', 'sjpp-drag-item')
			.style('margin', '3px')
			.style('cursor', 'default')
			.style('padding', '3px 10px')
			.style('border-radius', '5px')
			.style('color', (d: SampleCountEntry) => (d.samplecount == 0 ? '#777' : 'black'))
			.text((d: SampleCountEntry) => `${d.label}${d.samplecount !== undefined ? ` (n=${d.samplecount})` : ''}`)
			.style('background-color', '#eee')
			.each(function (this: Element) {
				const itemNode = select(this)
					.on('dragstart', function () {
						itemNode.style('background-color', '#fff2cc')
						handler.draggedItem = itemNode
					})
					.on('mouseenter', function () {
						itemNode.style('background-color', '#fff2cc')
					})
					.on('mouseleave', function () {
						itemNode.style('background-color', '#eee')
					})
			})
	}

	async removeGroup(group: GrpEntryWithDom) {
		this.removedGrp = true
		const itemsNum = group.wrapper.selectAll('.sjpp-drag-item').nodes()
		if (itemsNum.length === 0) {
			group.wrapper.remove()
		} else {
			group.input.remove()
			group.destroyBtn.remove()
			group.wrapper.remove()
			// reassign all values to excluded categories group
			for (const v of this.data.values) {
				if (v.group == group.currentIdx) v.group = 0
			}
		}
		await this.update()
	}

	async update() {
		this.dom.actionDiv.addGroup.property('disabled', this.data.groups.length >= this.maxGrpNum)
		for (const [i, grp] of this.data.groups.entries()) {
			if (i === 0) continue
			if (grp.currentIdx != i) {
				this.data.values
					.filter((v: SampleCountEntry) => v.group == grp.currentIdx)
					.forEach((v: SampleCountEntry) => (v.group = i))
				this.data.filters.filter(f => f.group == grp.currentIdx).forEach(f => (f.group = i))
				grp.currentIdx = i
			}
		}
		this.dom.grpsWrapper
			.selectAll('.sjpp-drag-drop-div')
			.data(this.data.groups)
			.each(async (group: GrpEntryWithDom) => {
				if (group.currentIdx !== 0) {
					group.input.node().value = group.name
					group.destroyBtn.property('disabled', this.data.groups.length <= this.minGrpNum)
				}
				await this.addItems(group)
			})
	}

	async onKeyUp(group: GrpEntryWithDom) {
		//Detect unique name on change. If not a unique name, alert the user and disable apply button
		if (group.name == group.input.node().value) return
		this.editedName = true
		const match = this.data.groups.filter((g: GrpEntryWithDom) => g.name == group.input.node().value)
		if (match.length > 0) {
			this.dom.actionDiv.applyBtn.property('disabled', true)
			group.inputMessage.style('display', 'block')
		} else {
			this.dom.actionDiv.applyBtn.property('disabled', false)
			group.inputMessage.style('display', 'none')
			this.data.groups[group.currentIdx].name = group.input.node().value.trim()
		}
	}
}
