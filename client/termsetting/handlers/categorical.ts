import { GroupSettingMethods } from './groupsetting.ts'
import { getPillNameDefault } from '../utils.ts'
import type { BaseGroupSet, GroupEntry, CategoricalQ, CategoricalTerm, CategoricalTermSettingInstance } from '#types'
import type { PillData } from '../types'

/*
********************** EXPORTED
getHandler(self)
	- self: a termsetting instance
	showEditMenu(div): // categorical edit menu
		showGrpOpts // create first menu with basic options e.g. groupset, predefined groupset
	getPillName() // Print term name in the pill
	getPillStatus() // Returns {text, bgcolor} which determines whether to make right half of the pill visible and show some text. Optional bgcolor can be used to highlight an error.
                    // Return null to hide the right half.
	validateQ(data)
	postMain() // update samplecount
setCategoryMethods()
	validateGroupsetting()
	showGrpOpts() // show menu for available groupset options
	grpSet2valGrp()
fillTW(tw, vocabApi)// Can handle initiation logic specific to this term type.
					// Must also guarantee tw.id and tw.term.id are set.
					// Computation should be independent of state, especially filter, as that’s not provided.

********************** INTERNAL
*/

export async function getHandler(self: CategoricalTermSettingInstance) {
	setCategoryMethods(self)

	return {
		getPillName(d: PillData) {
			return getPillNameDefault(self, d)
		},

		getPillStatus() {
			if (self.usecase?.target == 'regression') {
				return self.q.mode == 'binary' ? { text: 'binary' } : { text: 'categorical' }
			}
			return self.validateGroupsetting()
		},

		// TODO: can potentially remove validateQ() if type checking
		// proves to be sufficient
		validateQ(data: PillData) {
			const t = data.term as CategoricalTerm
			const q = data.q as CategoricalQ
			// validate the configuration
			if (q.type == 'values') {
				if (!t.values) self.error = 'no term.values defined'
				if (q.mode == 'binary') {
					if (Object.keys(t.values).length != 2) self.error = 'term.values must have exactly two keys'
					if (data.sampleCounts) {
						for (const key in t.values) {
							if (!data.sampleCounts.find(d => d.key === key))
								self.error = `there are no samples for the required binary value=${key}`
						}
					}
				}
			} else if (q.type == 'predefined-groupset' || q.type == 'custom-groupset') {
				let groupset: BaseGroupSet
				if (q.type == 'predefined-groupset') {
					if (!t.groupsetting) throw 'no term.groupsetting'
					if (!t.groupsetting.lst?.length) throw 'term.groupsetting.lst is empty'
					groupset = t.groupsetting.lst[q.predefined_groupset_idx]
					if (!groupset) throw 'no groupset entry for groupsetting.lst[predefined_groupset_idx]'
				} else {
					groupset = q.customset
					if (!groupset) throw 'invalid q.customset'
				}
				if (groupset.groups.some((g: GroupEntry) => g.name === undefined))
					throw 'every group in groupset must have .name defined'
				if (q.mode == 'binary') {
					if (groupset.groups.length != 2) throw 'there must be exactly two groups'
					if (data.sampleCounts) {
						for (const grp of groupset.groups) {
							if (!data.sampleCounts.find(d => d.label === grp.name))
								throw `there are no samples for the required binary value=${grp.name}`
						}
					}
				}
			}
		},

		async showEditMenu() {
			//for rendering groupsetting menu
			const holder = self.dom.tip.d.append('div')
			const loadingDiv = holder.append('div').style('margin', '10px').text('Getting categories...')
			const body = self.opts.getBodyParams?.() || {}
			const data = await self.vocabApi.getCategories(self.term, self.filter!, body)
			loadingDiv.style('display', 'none')
			/** Original code created a separate array (self.category2samplecount) and pushed only the key and label.
			 * The new self.category2samplecount was used to create the groupsetting menu items. That logic was removed
			 * as groupsetting.ts handles formating the data. However category2samplecount = [] is still used
			 * in other client side code. The data shape may differ until all the code is refactored.
			 */
			self.category2samplecount = data.lst
			await new GroupSettingMethods(self, { holder }).main()
		}
	}
}

export function setCategoryMethods(self: CategoricalTermSettingInstance) {
	self.validateGroupsetting = function () {
		if (self.q.type == 'values') return { text: '' }
		const text = self.q.name || self.q.reuseId
		if (text) return { text }
		if (self.q.type == 'predefined-groupset') {
			if (!Number.isInteger(self.q.predefined_groupset_idx))
				return { text: 'q.predefined_groupset_idx is not an integer', bgcolor: 'red' }
			if (!self.term.groupsetting?.lst?.length) return { text: 'term.groupsetting is empty', bgcolor: 'red' }
			const i = self.term.groupsetting.lst[self.q.predefined_groupset_idx]
			if (!i) return { text: 'term.groupsetting.lst entry is missing', bgcolor: 'red' }
			return { text: i.name }
		}
		if (self.q.type == 'custom-groupset') {
			if (!self.q.customset) return { text: 'q.customset is missing', bgcolor: 'red' }
			const n = self.q.customset.groups.filter(group => {
				if (group.type != 'values') throw `group.type must be 'values'`
				if (!group.uncomputable) return true
			}).length
			return { text: 'Divided into ' + n + ' groups' }
		}
		return { text: 'Unknown setting for groupsetting', bgcolor: 'red' }
	}
}
