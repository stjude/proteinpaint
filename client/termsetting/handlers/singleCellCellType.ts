import { GroupSettingMethods } from './groupsetting.ts'
import { getPillNameDefault, set_hiddenvalues } from '../termsetting.ts'
import { VocabApi } from '../../shared/types/index'
import {
	TermValues,
	PredefinedQGroupSetting,
	CustomQGroupSetting,
	TermGroupSetting,
	BaseGroupSet,
	GroupEntry
} from '../../shared/types/terms/term.ts'
import {
	SingleCellQ,
	SingleCellCellTypeTerm,
	SingleCellCellTypeTW
} from '../../shared/types/terms/singleCellCellType.ts'
import { PillData } from '../types.ts'
import { copyMerge } from '../../rx/index.js'

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

export async function getHandler(self) {
	setCategoryMethods(self)

	return {
		showEditMenu: self.showGrpOpts,

		getPillName(d: PillData) {
			return getPillNameDefault(self, d)
		},

		getPillStatus() {
			if (self.usecase?.target == 'regression') {
				return self.q.mode == 'binary' ? { text: 'binary' } : { text: 'categorical' }
			}
			return self.validateGroupsetting()
		},

		validateQ(data: PillData) {
			const t = data.term as SingleCellCellTypeTerm
			const q = data.q as SingleCellQ
			const endNote = `(${t.type}, mode='${q.mode}', type='${q.type}')`
			// validate the configuration
			if (q.type == 'values') {
				if (!t.values) self.error = `no term.values defined ${endNote}`
				if (q.mode == 'binary') {
					if (Object.keys(t.values as TermValues).length != 2)
						self.error = `term.values must have exactly two keys ${endNote}`

					if (data.sampleCounts) {
						for (const key in t.values) {
							if (!data.sampleCounts.find(d => d.key === key))
								self.error = `there are no samples for the required binary value=${key} ${endNote}`
						}
					}
				}
				return
			}

			if (q.type == 'predefined-groupset' || q.type == 'custom-groupset') {
				const tgs = t.groupsetting as TermGroupSetting
				if (!tgs) throw `no term.groupsetting ${endNote}`

				let groupset!: BaseGroupSet
				if (q.groupsetting && q.type == 'predefined-groupset') {
					const gs = q.groupsetting as PredefinedQGroupSetting
					const idx = gs.predefined_groupset_idx as number
					if (tgs.lst && !tgs.lst[idx]) throw `no groupsetting[predefined_groupset_idx=${idx}] ${endNote}`
					else if (tgs.lst) groupset = tgs.lst[idx]
				} else if (q.groupsetting) {
					const gs = q.groupsetting as CustomQGroupSetting
					if (!gs.customset) throw `no q.groupsetting.customset defined ${endNote}`
					groupset = gs.customset
				}

				if (!groupset.groups.every((g: GroupEntry) => g.name !== undefined))
					throw `every group in groupset must have 'name' defined ${endNote}`

				if (q.mode == 'binary') {
					if (groupset.groups.length != 2) throw `there must be exactly two groups ${endNote}`

					if (data.sampleCounts) {
						for (const grp of groupset.groups) {
							if (!data.sampleCounts.find(d => d.label === grp.name))
								throw `there are no samples for the required binary value=${grp.name} ${endNote}`
						}
					}
				}
				return
			}
			throw `unknown xxxx q.type='${q.type}' for categorical q.mode='${q.mode}'`
		},

		async postMain() {
			//for rendering groupsetting menu
			const body = self.opts.getBodyParams?.() || {}
			const data = await self.vocabApi.getCategories(self.term, self.filter!, body)
			/** Original code created a separate array (self.category2samplecount) and pushed only the key and label.
			 * The new self.category2samplecount was used to create the groupsetting menu items. That logic was removed
			 * as groupsetting.ts handles formating the data. However category2samplecount = [] is still used
			 * in other client side code. The data shape may differ until all the code is refactored.
			 */
			self.category2samplecount = data.lst
			if (!self.term.values) {
				self.q = {}
			} // ...
		}
	}
}

export function setCategoryMethods(self) {
	self.validateGroupsetting = function () {
		if (!self.q.groupsetting || !self.q.groupsetting.inuse) return
		const text = self.q.name || self.q.reuseId
		if (text) return { text }
		if (self.q.groupsetting.predefined_groupset_idx && Number.isInteger(self.q.groupsetting.predefined_groupset_idx)) {
			if (!self.term.groupsetting) return { text: 'term.groupsetting missing', bgcolor: 'red' }
			if (!self.term.groupsetting.lst) return { text: 'term.groupsetting.lst[] missing', bgcolor: 'red' }
			const i = self.term.groupsetting.lst[self.q.groupsetting.predefined_groupset_idx]
			if (!i)
				return {
					text: 'term.groupsetting.lst[' + self.q.groupsetting.predefined_groupset_idx + '] missing',
					bgcolor: 'red'
				}
			return { text: i.name }
		}
		if (self.q.groupsetting.customset) {
			const n = self.q.groupsetting.customset.groups.length
			return { text: 'Divided into ' + n + ' groups' }
		}
		return { text: 'Unknown setting for groupsetting', bgcolor: 'red' }
	}

	self.showGrpOpts = async function () {
		await new GroupSettingMethods(Object.assign(self, { newMenu: true })).main()
	}
}

export function fillTW(tw: SingleCellCellTypeTW, vocabApi: VocabApi, defaultQ = null) {
	if (!tw.term?.sample) throw 'missing term.sample'
	if (!tw.term?.plot) throw 'missing term.plot'
	if (!('type' in tw.q)) tw.q.type = 'values' // must fill default q.type if missing
	if (!tw.q.groupsetting) (tw.q.groupsetting as any) = {}
	if (!tw.term.groupsetting) (tw.term.groupsetting as any) = {}
	if (tw.term.groupsetting.disabled) {
		//** .disabled is not used on q.groupsetting */
		// tw.q.groupsetting.disabled = true
		return
	}
	// delete tw.q.groupsetting.disabled
	if (!('inuse' in (tw.q as SingleCellQ).groupsetting)) tw.q.groupsetting.inuse = false // do not apply by default

	// inuse:false is either from automatic setup or predefined in state
	if (tw.q.groupsetting.inuse) {
		const gs = tw.q.groupsetting as PredefinedQGroupSetting
		if (
			tw.term.groupsetting.lst &&
			//Typescript emits error that .useIndex could be undefined
			tw.term.groupsetting.useIndex &&
			//Fix checks if property is present
			tw.term.groupsetting.useIndex >= 0 &&
			tw.term.groupsetting.lst[tw.term.groupsetting.useIndex]
		) {
			gs.predefined_groupset_idx = tw.term.groupsetting.useIndex
		}
	}

	if (defaultQ) {
		//TODO change when Q objects separated out
		;(defaultQ as SingleCellQ).isAtomic = true
		// merge defaultQ into tw.q
		copyMerge(tw.q, defaultQ)
	}

	set_hiddenvalues(tw.q, tw.term)
}
