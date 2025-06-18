import { getPillNameDefault } from '../termsetting'
import type { GeneVariantTermSettingInstance } from '#types'
import type { PillData } from '../types'
import { make_radios } from '#dom'
import { GroupSettingMethods } from './groupsetting.ts'
import { getChildTerms } from '../../tw/geneVariant.ts'

// self is the termsetting instance
export function getHandler(self: GeneVariantTermSettingInstance) {
	return {
		getPillName(d: PillData) {
			return getPillNameDefault(self, d)
		},

		getPillStatus() {
			let text
			if (self.q.type == 'custom-groupset') {
				const n = self.q.customset.groups.filter(group => !group.uncomputable).length
				text = `Divided into ${n} groups`
			} else {
				text = 'any variant class'
			}
			return { text }
		},

		async showEditMenu(div: Element) {
			await makeEditMenu(self, div)
		},

		async postMain() {
			await getChildTerms(self.term, self.vocabApi)
		}
	}
}

async function makeEditMenu(self: GeneVariantTermSettingInstance, _div: any) {
	/* TODO: instead of directly modifying self.q here, should create a separate property on the handler to store pending user
	configurations (similar to numeric continuous/discrete switching)
	const handler = self.handlerByType.geneVariant
	*/
	const div = _div.append('div').style('padding', '10px')
	div.append('div').style('font-size', '1.2rem').text(self.term.name)
	const optsDiv = div.append('div').style('margin-top', '10px').style('margin-bottom', '1px')
	const groupsDiv = div
		.append('div')
		.style('display', 'none')
		.style('margin', '5px 0px 0px 30px')
		.style('vertical-align', 'top')
	const draggablesDiv = div.append('div').style('display', 'none').style('margin-left', '15px')
	// apply button
	// must create it at beginning to allow toggling applySpan message
	const applyRow = div.append('div').style('margin-top', '15px')
	applyRow
		.append('button')
		.style('display', 'inline-block')
		.text('Apply')
		.on('click', () => {
			if (self.groupSettingInstance) self.groupSettingInstance.processDraggables()
			let validGrpset = false
			if (self.q.type == 'custom-groupset') {
				// groupset is assigned
				if (self.q.customset?.groups.map((group: any) => group.filter?.lst).some(lst => lst.length)) {
					// filters in groupset are non-empty
					validGrpset = true
				}
			}
			if (!validGrpset) {
				// groupset is not valid, so clear it
				clearGroupset(self)
			}
			self.runCallback()
		})
	applyRow
		.append('span')
		.attr('id', 'applySpan')
		.style('display', 'none')
		.style('padding-left', '15px')
		.style('opacity', 0.8)
		.style('font-size', '.8em')
		.text('Only tested variants are considered')

	// radio buttons for whether or not to group variants
	optsDiv.append('div').style('font-weight', 'bold').text('Group variants')
	const isGroupset = self.q.type == 'custom-groupset'
	const radios = make_radios({
		holder: optsDiv,
		options: [
			{ label: 'No variant grouping', value: 'noGroup', checked: !isGroupset },
			{ label: 'Assign variants to groups', value: 'group', checked: isGroupset }
		],
		callback: async v => {
			if (v == 'group') {
				await makeGroupUI()
			} else {
				clearGroupset(self)
				groupsDiv.style('display', 'none')
				draggablesDiv.style('display', 'none')
				applyRow.select('#applySpan').style('display', 'none')
			}
		}
	})

	if (self.usecase?.detail == 'term0' || self.usecase?.detail == 'term2' || self.opts.geneVariantEditMenuOnlyGrp) {
		// hide option for turning off groupsetting
		optsDiv.style('display', 'none')
		groupsDiv.style('margin-top', '10px')
	}

	const selected = radios.inputs.filter(d => d.checked)
	if (selected.property('value') == 'group') await makeGroupUI()

	// make radio buttons for grouping variants
	async function makeGroupUI() {
		self.q.type = 'custom-groupset'
		await makeGroupsetDraggables()
		applyRow.select('#applySpan').style('display', 'inline')
	}

	// function for making groupset draggables
	async function makeGroupsetDraggables() {
		draggablesDiv.style('display', 'inline-block')
		draggablesDiv.selectAll('*').remove()
		self.groupSettingInstance = new GroupSettingMethods(self, {
			type: 'filter',
			holder: draggablesDiv,
			hideApply: true
		})
		await self.groupSettingInstance.main()
	}
}

function clearGroupset(self) {
	self.q.type = 'values'
	delete self.q.predefined_groupset_idx
	delete self.q.customset
	delete self.groupSettingInstance
}
