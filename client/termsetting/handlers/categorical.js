import { setGroupsettingMethods } from './groupsetting'
import { filterInit } from '#filter'
import { getPillNameDefault, set_hiddenvalues } from '#termsetting'

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
setCategoryConditionMethods()
	validateGroupsetting()
	showGrpOpts() // show menu for available groupset options
	grpSet2valGrp()
fillTW(tw, vocabApi)// Can handle initiation logic specific to this term type.
					// Must also guarantee tw.id and tw.term.id are set.
					// Computation should be independent of state, especially filter, as that’s not provided.

********************** INTERNAL
*/

export function getHandler(self) {
	setGroupsettingMethods(self)
	setCategoryConditionMethods(self)

	return {
		showEditMenu: self.showGrpOpts,

		getPillName(d) {
			return getPillNameDefault(self, d)
		},

		getPillStatus: self.validateGroupsetting,

		validateQ(data) {
			const t = data.term
			const endNote = `(${t.type}, mode='${data.q.mode}', type='${data.q.type}')`
			// validate the configuration
			if (data.q.type == 'values') {
				if (!t.values) self.error = `no term.values defined ${endNote}`
				if (data.q.mode == 'binary') {
					if (Object.keys(t.values).length != 2) self.error = `term.values must have exactly two keys ${endNote}`

					if (data.sampleCounts) {
						for (const key in t.values) {
							if (!data.sampleCounts.find(d => d.key === key))
								self.error = `there are no samples for the required binary value=${key} ${endNote}`
						}
					}
				}
				return
			}

			if (data.q.type == 'predefined-groupset' || data.q.type == 'custom-groupset') {
				const tgs = t.groupsetting
				if (!tgs) throw `no term.groupsetting ${endNote}`

				let groupset
				if (data.q.type == 'predefined-groupset') {
					const idx = data.q.groupsetting.predefined_groupset_idx
					if (!tgs.lst[idx]) throw `no groupsetting[predefined_groupset_idx=${idx}] ${endNote}`
					groupset = tgs.lst[idx]
				} else {
					if (!data.q.groupsetting.customset) throw `no q.groupsetting.customset defined ${endNote}`
					groupset = data.q.groupsetting.customset
				}

				if (!groupset.groups.every(g => g.name !== undefined))
					throw `every group in groupset must have 'name' defined ${endNote}`

				if (data.q.mode == 'binary') {
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
			console.log(88, data)
			throw `unknown xxxx q.type='${data.q.type}' for categorical q.mode='${data.q.mode}'`
		},

		async postMain() {
			const lst = []
			if (self.term.type == 'condition') {
				// bar_by_grade / bar_by_children
				lst.push(self.q.bar_by_grade ? 'bar_by_grade=1' : self.q.bar_by_children ? 'bar_by_children=1' : null)
				// value_by_max_grade / value_by_most_recent / value_by_computable_grade
				lst.push(
					self.q.value_by_max_grade
						? 'value_by_max_grade=1'
						: self.q.value_by_most_recent
						? 'value_by_most_recent=1'
						: self.q.value_by_computable_grade
						? 'value_by_computable_grade=1'
						: null
				)
			}
			const data = await self.vocabApi.getCategories(self.term, self.filter, lst)
			self.category2samplecount = []
			for (const i of data.lst) {
				self.category2samplecount.push({ key: i.key, count: i.samplecount })
			}
		}
	}
}

// same method used to set methods for categorical and condition terms
export function setCategoryConditionMethods(self) {
	self.validateGroupsetting = function() {
		if (!self.q.groupsetting || !self.q.groupsetting.inuse) return
		const text = self.q?.name || self.q?.reuseId
		if (text) return { text }
		if (Number.isInteger(self.q.groupsetting.predefined_groupset_idx)) {
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
			if (self.q.bar_by_grade) return { text: n + ' groups of grades' }
			if (self.q.bar_by_children) return { text: n + ' groups of sub-conditions' }
			return { text: 'Divided into ' + n + ' groups' }
		}
		return { text: 'Unknown setting for groupsetting', bgcolor: 'red' }
	}

	/******************* Functions for Categorical terms *******************/
	self.showGrpOpts = async function(_div) {
		const tgs = self.term.groupsetting
		const qgs = self.q?.groupsetting
		const activeGroup = tgs?.lst?.[qgs?.predefined_groupset_idx] || (qgs?.inuse && qgs.customset)

		if (!activeGroup) self.regroupMenu()
		else {
			const valGrp = self.grpSet2valGrp(activeGroup)
			self.regroupMenu(activeGroup.groups.length, valGrp)
		}
	}

	self.getQlst = () => {
		const values = self.q.bar_by_children ? self.term.subconditions : self.term.values
		const defaultGrpName = `default categories ${values ? '(n=' + Object.keys(values).length + ')' : ''}`
		const activeName = self.q.name || qgs?.name || activeGroup?.name || defaultGrpName

		//show button/s for default groups
		const gsLst = tgs?.lst || []
		const qlst = self.vocabApi.getCustomTermQLst(self.term)
		const lst = [...gsLst, ...qlst].sort((a, b) => (a.name === self.q.name ? -1 : 0))
		return lst.map(q => {
			return {
				name: q.name || defaultGrpName,
				isActive: activeName === defaultGrpName,
				callback
			}
		})
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

	function mayShowGroupDetails(tgs, qgs, groupset, div) {
		return
		const active_group_info_div = div.append('div').style('margin', '10px')

		//display groups and categories assigned to that group
		if (!qgs?.inuse) return
		console.log(161, groupset)
		const group_table = active_group_info_div.append('table').style('font-size', '.8em')

		for (const [i, g] of groupset.groups.entries()) {
			const group_tr = group_table.append('tr')

			//group name
			group_tr
				.append('td')
				.style('font-weight', 'bold')
				.style('vertical-align', 'top')
				.html(g.name != undefined ? g.name + ':' : 'Group ' + (i + 1) + ':')

			const values_td = group_tr.append('td')
			if (!g.type || g.type == 'values') {
				for (const v of g.values) {
					values_td.append('div').html(values[v.key].label)
				}
			} else if (g.type == 'filter') {
				const cohortFilter = tgs.lst[0].groups[i].filter4activeCohort
				if (!g.filter && cohortFilter) {
					const filter = JSON.parse(JSON.stringify(cohortFilter[self.activeCohort]))

					// show filter for predefined tvslst for activeCohort
					filterInit({
						btn: values_td.append('div'),
						btnLabel: 'Filter',
						emptyLabel: '+New Filter',
						holder: values_td.append('div').style('width', '300px'),
						vocabApi: self.vocabApi,
						callback: () => {}
					}).main(filter)
				}
			}
		}
	}

	self.grpSet2valGrp = function(groupset) {
		const values = self.q.bar_by_children ? self.term.subconditions : self.term.values
		const vals_with_grp = JSON.parse(JSON.stringify(values))
		for (const [i, g] of groupset.groups.entries()) {
			if (!g.type || g.type == 'values') {
				for (const v of g.values) {
					vals_with_grp[v.key].group = i + 1
				}
			}
		}

		for (const [key, val] of Object.entries(vals_with_grp)) {
			if (vals_with_grp[key].group == undefined) vals_with_grp[key].group = 0
		}

		return vals_with_grp
	}
}

export function fillTW(tw, vocabApi) {
	set_hiddenvalues(tw.q, tw.term)
	if (!('type' in tw.q)) tw.q.type = 'values' // must fill default q.type if missing
	if (!tw.q.groupsetting) tw.q.groupsetting = {}
	if (!tw.term.groupsetting) tw.term.groupsetting = {}
	if (tw.term.groupsetting.disabled) {
		tw.q.groupsetting.disabled = true
		return
	}
	delete tw.q.groupsetting.disabled
	if (!('inuse' in tw.q.groupsetting)) tw.q.groupsetting.inuse = false // do not apply by default

	if (tw.term.type == 'condition') {
		/*
		for condition term, must set up bar/value flags before quiting for inuse:false
		*/
		if (tw.q.value_by_max_grade || tw.q.value_by_most_recent || tw.q.value_by_computable_grade) {
			// need any of the three to be set
		} else {
			// set a default one
			tw.q.value_by_max_grade = true
		}
		if (tw.q.bar_by_grade || tw.q.bar_by_children) {
		} else {
			tw.q.bar_by_grade = true
		}
	}

	// inuse:false is either from automatic setup or predefined in state
	if (tw.q.groupsetting.inuse) {
		if (
			tw.term.groupsetting.lst &&
			tw.term.groupsetting.useIndex >= 0 &&
			tw.term.groupsetting.lst[tw.term.groupsetting.useIndex]
		) {
			tw.q.groupsetting.predefined_groupset_idx = tw.term.groupsetting.useIndex
		}
	}
}
