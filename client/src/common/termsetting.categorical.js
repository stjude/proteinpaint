import { setGroupsettingMethods } from './termsetting.groupsetting'
import { getNormalRoot } from './filter'
import { dofetch3 } from './dofetch'

/*
Arguments
self: a termsetting instance
*/

export function setCategoricalMethods(self) {
	setGroupsettingMethods(self)

	self.showEditMenu = function(div) {
		self.showGrpOpts(div)
	}

	self.get_term_name = function(d) {
		if (!self.opts.abbrCutoff) return d.name
		return d.name.length <= self.opts.abbrCutoff + 2
			? d.name
			: '<label title="' + d.name + '">' + d.name.substring(0, self.opts.abbrCutoff) + '...' + '</label>'
	}

	self.get_status_msg = function() {
		// get message text for the right half pill; may return null
		if (self.q.groupsetting && self.q.groupsetting.inuse) {
			if (Number.isInteger(self.q.groupsetting.predefined_groupset_idx)) {
				if (!self.term.groupsetting) return 'term.groupsetting missing'
				if (!self.term.groupsetting.lst) return 'term.groupsetting.lst[] missing'
				const i = self.term.groupsetting.lst[self.q.groupsetting.predefined_groupset_idx]
				if (!i) return 'term.groupsetting.lst[' + self.q.groupsetting.predefined_groupset_idx + '] missing'
				return i.name
			}
			if (self.q.groupsetting.customset) {
				const n = self.q.groupsetting.customset.groups.length
				if (self.q.bar_by_grade) return n + ' groups of grades'
				if (self.q.bar_by_children) return n + ' groups of sub-conditions'
				return 'Divided into ' + n + ' groups'
			}
			return 'Unknown setting for groupsetting'
		}
		if (self.term.type == 'condition') {
			if (self.q.bar_by_grade) {
				if (self.q.value_by_max_grade) return 'Max. Grade'
				if (self.q.value_by_most_recent) return 'Most Recent Grade'
				if (self.q.value_by_computable_grade) return 'Any Grade'
				return 'Error: unknown grade setting'
			}
			if (self.q.bar_by_children) {
				return 'Sub-condition'
			}
			return 'Error: unknown setting for term.type == "condition"'
		}
		return null // for no label
	}

	self.addCategory2sampleCounts = async function() {
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

	self.validateQ = function(data) {
		const t = data.term
		const q = JSON.parse(JSON.stringify(data.q))
		const endNote = `(${t.type}, mode='${q.mode}', type='${q.type}')`
		// validate the configuration
		if (!('type' in q)) q.type = 'values' // default
		if (q.type == 'values') {
			if (!t.values) self.error = `no term.values defined ${endNote}`
			if (q.mode == 'binary') {
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

		if (q.type == 'predefined-groupset' || q.type == 'custom-groupset') {
			const tgs = t.groupsetting
			if (!tgs) throw `no term.groupsetting ${endNote}`

			let groupset
			if (q.type == 'predefined-groupset') {
				const idx = q.groupsetting.predefined_groupset_idx
				if (!tgs.lst[idx]) throw `no groupsetting[predefined_groupset_idx=${idx}] ${endNote}`
				groupset = tgs.lst[idx]
			} else {
				if (!q.groupsetting.customset) throw `no q.groupsetting.customset defined ${endNote}`
				groupset = q.groupsetting.customset
			}

			if (!groupset.groups.every(g => g.name !== undefined))
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

		throw `unknown q.type='${q.type}' for categorical q.mode='${q.mode}'`
	}

	/******************* Functions for Categorical terms *******************/
	self.showGrpOpts = async function(div) {
		const grpsetting_flag = self.q && self.q.groupsetting && self.q.groupsetting.inuse
		const predefined_group_name =
			self.term.groupsetting &&
			self.term.groupsetting.lst &&
			self.q.groupsetting &&
			self.q.groupsetting.predefined_groupset_idx != undefined
				? self.term.groupsetting.lst[self.q.groupsetting.predefined_groupset_idx].name
				: ''
		const values = self.q.bar_by_children ? self.term.subconditions : self.term.values
		const active_group_info_div = div.append('div').style('margin', '10px')

		// if using predfined groupset, display name
		active_group_info_div
			.append('div')
			.style('display', grpsetting_flag && predefined_group_name ? 'block' : 'none')
			.style('font-size', '.9em')
			.style('font-weight', 'bold')
			.style('text-align', 'center')
			.style('padding-bottom', '5px')
			.html('Using ' + predefined_group_name)

		//display groups and categories assigned to that group
		if (grpsetting_flag) {
			const groupset =
				self.q.groupsetting.predefined_groupset_idx != undefined
					? self.term.groupsetting.lst[self.q.groupsetting.predefined_groupset_idx]
					: self.q.groupsetting.customset || undefined

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

				for (const v of g.values) {
					values_td.append('div').html(values[v.key].label)
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
					const valGrp = self.grpSet2valGrp(groupset)
					self.regroupMenu(groupset.groups.length, valGrp)
				})
		}

		const default_btn_txt =
			(!grpsetting_flag ? 'Using' : 'Use') +
			' default categories ' +
			(values ? '(n=' + Object.keys(values).length + ')' : '')

		// default overlay btn - devide to n groups (n=total)
		div
			.append('div')
			.attr('class', 'group_btn sja_menuoption')
			.style('display', self.q.mode == 'binary' ? 'none' : 'block')
			// .style('padding', '7px 6px')
			.style('margin', '5px')
			.style('text-align', 'center')
			.style('font-size', '.8em')
			.style('border-radius', '13px')
			.style('background-color', !grpsetting_flag ? '#fff' : '#eee')
			.style('color', !grpsetting_flag ? '#888' : '#000')
			.style('pointer-events', !grpsetting_flag ? 'none' : 'auto')
			.text(default_btn_txt)
			.on('click', () => {
				self.q.groupsetting.inuse = false
				delete self.q.groupsetting.predefined_groupset_idx
				// self.q.type = 'values' ????
				self.dom.tip.hide()
				self.opts.callback({
					term: self.term,
					q: self.q
				})
			})

		//show button/s for default groups
		if (self.term.groupsetting && self.term.groupsetting.lst) {
			for (const [i, group] of self.term.groupsetting.lst.entries()) {
				if (self.q.groupsetting && self.q.groupsetting.predefined_groupset_idx != i)
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
						.style('margin', '5px')
						.style('text-align', 'center')
						.style('font-size', '.8em')
						.style('border-radius', '13px')
						.html('Use <b>' + group.name + '</b>')
						.on('click', () => {
							self.q.groupsetting.inuse = true
							self.q.groupsetting.predefined_groupset_idx = i
							self.q.type = 'predefined-groupset'
							self.dom.tip.hide()
							self.opts.callback({
								term: self.term,
								q: self.q
							})
						})
			}
		}

		// devide to grpups btn
		div
			.append('div')
			.attr('class', 'group_btn sja_menuoption')
			.style(
				'display',
				(self.term.groupsetting && self.term.groupsetting.disabled) || grpsetting_flag ? 'none' : 'block'
			)
			// .style('padding', '7px 6px')
			.style('margin', '5px')
			.style('text-align', 'center')
			.style('font-size', '.8em')
			.style('border-radius', '13px')
			.html(
				'Divide <b>' +
					(self.term.name.length > 25 ? self.term.name.substring(0, 24) + '...' : self.term.name) +
					'</b> to groups'
			)
			.on('click', () => {
				self.regroupMenu()
			})
	}

	self.grpSet2valGrp = function(groupset) {
		const values = self.q.bar_by_children ? self.term.subconditions : self.term.values
		const vals_with_grp = JSON.parse(JSON.stringify(values))
		for (const [i, g] of groupset.groups.entries()) {
			for (const v of g.values) {
				vals_with_grp[v.key].group = i + 1
			}
		}

		for (const [key, val] of Object.entries(vals_with_grp)) {
			if (vals_with_grp[key].group == undefined) vals_with_grp[key].group = 0
		}

		return vals_with_grp
	}
}
