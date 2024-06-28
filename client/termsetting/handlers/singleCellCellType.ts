import { GroupSettingMethods } from './groupsetting.ts'
// import { filterInit } from '#filter'
import { getPillNameDefault, set_hiddenvalues } from '../termsetting.ts'
import { VocabApi } from '../../shared/types/index'
import {
	Term,
	TermValues,
	PredefinedGroupSetting,
	CustomGroupSetting,
	BaseGroupSet,
	GroupEntry
} from '../../shared/types/terms/term.ts'
import { CategoricalQ, CategoricalTW } from '../../shared/types/terms/categorical.ts'
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
			const t = data.term as Term
			const q = data.q as CategoricalQ
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
				const tgs = t.groupsetting as PredefinedGroupSetting
				if (!tgs) throw `no term.groupsetting ${endNote}`

				let groupset!: BaseGroupSet
				if (q.groupsetting && q.type == 'predefined-groupset') {
					const gs = q.groupsetting as PredefinedGroupSetting
					const idx = gs.predefined_groupset_idx as number
					if (tgs.lst && !tgs.lst[idx]) throw `no groupsetting[predefined_groupset_idx=${idx}] ${endNote}`
					else if (tgs.lst) groupset = tgs.lst[idx]
				} else if (q.groupsetting) {
					const gs = q.groupsetting as CustomGroupSetting
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
		// const tgs = self.term.groupsetting
		// const qgs = self.q?.groupsetting as GroupSetting
		// const activeGroup = qgs?.predefined_groupset_idx
		// 	? tgs?.lst?.[qgs?.predefined_groupset_idx]
		// 	: qgs?.inuse && qgs.customset

		// if (!activeGroup) await new GroupSettingMethods(Object.assign(self, {newMenu: true})).main()
		// else {
		//const valGrp = self.grpSet2valGrp(activeGroup)
		await new GroupSettingMethods(Object.assign(self, { newMenu: true })).main()
		// }
	}

	self.getQlst = () => {
		/********* Not used at all?? Commented out b/c of type errors *********/
		// const values = self.q.bar_by_children ? self.term.subconditions : self.term.values
		// const defaultGrpName = `default categories ${values ? '(n=' + Object.keys(values).length + ')' : ''}`
		// const activeName = self.q.name || qgs?.name || activeGroup?.name || defaultGrpName
		// //show button/s for default groups
		// const gsLst = tgs?.lst || []
		// const qlst = self.vocabApi.getCustomTermQLst(self.term)
		// const lst = [...gsLst, ...qlst].sort((a, b) => (a.name === self.q.name ? -1 : 0))
		// return lst.map(q => {
		// 	return {
		// 		name: q.name || defaultGrpName,
		// 		isActive: activeName === defaultGrpName,
		// 		callback
		// 	}
		// })
		/*
		const div = _div.append('div').style('display', 'grid')
		div
			.append('div')
			.style('font-size', '.9em')
			.style('padding', '10px')
			.style('text-align', 'center')
			.html(`Using ${activeName}`)

		mayShowGroupDetails(tgs, qgs, activeGroup, div)

		// default overlay btn - divide to n groups (n=total)
		if (activeName != defaultGrpName) {
			div
				.append('div')
				.attr('class', 'group_btn sja_menuoption')
				// .style('padding', '7px 6px')
				.style('margin', '5px')
				.style('text-align', 'center')
				.style('font-size', '.8em')
				.style('border-radius', '13px')
				.style('background-color', !qgs?.inuse ? '#fff' : '#eee')
				.style('color', !qgs?.inuse ? '#888' : '#000')
				.style('pointer-events', !qgs?.inuse ? 'none' : 'auto')
				.text('Use ' + defaultGrpName)
				.on('click', () => {
					qgs.inuse = false
					delete qgs.predefined_groupset_idx
					delete self.q.name
					// self.q.type = 'values' ????
					self.dom.tip.hide()
					self.runCallback()
				})
		}

		//show button/s for default groups
		const gsLst = tgs?.lst || []
		const qlst = self.vocabApi.getCustomTermQLst(self.term)
		const lst = [...gsLst, ...qlst].sort((a, b) => (a.name === self.q.name ? -1 : 0))

		for (const [i, group] of lst.entries()) {
			if (group.name === activeName) continue

			div
				.append('div')
				.attr('class', 'group_btn sja_menuoption')
				.style(
					'display',
					(group.is_grade && !self.q.bar_by_grade) || (group.is_subcondition && !self.q.bar_by_children)
						? 'none'
						: 'block'
				)
				// .style('padding', '7px 6px')
				.style('grid-column', '1')
				.style('margin', '5px')
				.style('text-align', 'center')
				.style('font-size', '.8em')
				.style('border-radius', '13px')
				.html(`Use <b>${group.name}</b>`)
				.on('click', () => {
					qgs.inuse = true
					if (group.groupsetting.customset) {
						self.q = group
					} else {
						qgs.predefined_groupset_idx = i
						// used for groupsetting if one of the group is filter rahter than values,
						// Not in use rightnow, if used in future, uncomment following line
						// self.q.groupsetting.activeCohort = self.activeCohort
						self.q.type = 'predefined-groupset'
					}
					self.dom.tip.hide()
					self.runCallback()
				})

			if (group.name) {
				div
					.append('div')
					.style('grid-column', '2/3')
					.style('margin', '5px')
					.style('padding', '5px')
					.style('cursor', 'pointer')
					.style('color', '#999')
					.style('font-size', '.8em')
					.text('DELETE')
					.on('click', async () => {
						await self.vocabApi.uncacheTermQ(self.term, group)
						if (group.name === self.q.name) delete self.q.name
						self.dom.tip.hide()
					})
			}
		}

		//redevide groups btn
		div
			.append('div')
			.attr('class', 'group_btn sja_menuoption')
			.style('display', 'block')
			// .style('padding', '7px 6px')
			.style('margin', '5px')
			.style('text-align', 'center')
			.style('font-size', '.8em')
			.style('border-radius', '12px')
			.html('Redivide groups')
			.on('click', () => {
				if (!activeGroup) self.regroupMenu()
				else {
					const valGrp = self.grpSet2valGrp(activeGroup)
					self.regroupMenu(activeGroup.groups.length, valGrp)
				}
			})

		self.renderQNameInput(div, `Grouping`)
		*/
	}

	// function mayShowGroupDetails(tgs, qgs, groupset, div) {
	// 	return
	// 	const active_group_info_div = div.append('div').style('margin', '10px')

	// 	//display groups and categories assigned to that group
	// 	if (!qgs?.inuse) return
	// 	console.log(161, groupset)
	// 	const group_table = active_group_info_div.append('table').style('font-size', '.8em')

	// 	for (const [i, g] of groupset.groups.entries()) {
	// 		const group_tr = group_table.append('tr')

	// 		//group name
	// 		group_tr
	// 			.append('td')
	// 			.style('font-weight', 'bold')
	// 			.style('vertical-align', 'top')
	// 			.html(g.name != undefined ? g.name + ':' : 'Group ' + (i + 1) + ':')

	// 		const values_td = group_tr.append('td')
	// 		if (!g.type || g.type == 'values') {
	// 			for (const v of g.values) {
	// 				values_td.append('div').html(values[v.key].label)
	// 			}
	// 		} else if (g.type == 'filter') {
	// 			const cohortFilter = tgs.lst[0].groups[i].filter4activeCohort
	// 			if (!g.filter && cohortFilter) {
	// 				const filter = JSON.parse(JSON.stringify(cohortFilter[self.activeCohort]))

	// 				// show filter for predefined tvslst for activeCohort
	// 				filterInit({
	// 					btn: values_td.append('div'),
	// 					btnLabel: 'Filter',
	// 					emptyLabel: '+New Filter',
	// 					holder: values_td.append('div').style('width', '300px'),
	// 					vocabApi: self.vocabApi,
	// 					callback: () => {}
	// 				}).main(filter)
	// 			}
	// 		}
	// 	}
	// }

	//No longer needed??
	// self.grpSet2valGrp = function (groupset: BaseGroupSet) {
	// 	const values = self.term.values || {}
	// 	/*
	// 	values{} is an object of key:{key,label,color}
	// 	it is read only attribute of the term object
	// 	duplicate it in order to introduce new attribute "group":INT to each value
	// 	*/
	// 	const vals_with_grp = structuredClone(values)
	// 	if (vals_with_grp == undefined) throw `Missing group values [categorical.ts grpSet2valGrp()]`
	// 	for (const [i, g] of groupset.groups.entries()) {
	// 		if (!g.type || g.type == 'values') {
	// 			for (const v of g.values) {
	// 				if (!vals_with_grp[v.key]) {
	// 					// **note!** gdc terms lack term.values{}, must fill in on the fly
	// 					vals_with_grp[v.key] = { key: v.key as string, label: v.key }
	// 				}

	// 				vals_with_grp[v.key].group = i + 1
	// 			}
	// 		}
	// 	}

	// 	for (const key of Object.keys(vals_with_grp)) {
	// 		if (vals_with_grp[key].group == undefined) vals_with_grp[key].group = 0
	// 	}

	// 	return vals_with_grp
	// }
}

export function fillTW(tw: CategoricalTW, vocabApi: VocabApi, defaultQ = null) {
	if (!('type' in tw.q)) tw.q.type = 'values' // must fill default q.type if missing
	if (!tw.q.groupsetting) tw.q.groupsetting = {}
	if (!tw.term.groupsetting) tw.term.groupsetting = {}
	if (tw.term.groupsetting.disabled) {
		tw.q.groupsetting.disabled = true
		return
	}
	delete tw.q.groupsetting.disabled
	if (!('inuse' in tw.q.groupsetting)) tw.q.groupsetting.inuse = false // do not apply by default

	// inuse:false is either from automatic setup or predefined in state
	if (tw.q.groupsetting.inuse) {
		const gs = tw.q.groupsetting as PredefinedGroupSetting
		if (
			gs.lst &&
			//Typescript emits error that .useIndex could be undefined
			gs.useIndex &&
			//Fix checks if property is present
			gs.useIndex >= 0 &&
			gs.lst[gs.useIndex]
		) {
			gs.predefined_groupset_idx = gs.useIndex
		}
	}

	if (defaultQ) {
		//TODO change when Q objects separated out
		;(defaultQ as CategoricalQ).isAtomic = true
		// merge defaultQ into tw.q
		copyMerge(tw.q, defaultQ)
	}

	set_hiddenvalues(tw.q, tw.term)
}
