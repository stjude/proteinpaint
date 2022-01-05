import { setCategoricalMethods } from './termsetting.categorical'
import { setGroupsettingMethods } from './termsetting.groupsetting'

/*
Arguments
self: a termsetting instance
*/
export function getHandler(self) {
	setGroupsettingMethods(self)
	setCategoricalMethods(self)

	return {
		get_term_name(d) {
			if (!self.opts.abbrCutoff) return d.name
			return d.name.length <= self.opts.abbrCutoff + 2
				? d.name
				: '<label title="' + d.name + '">' + d.name.substring(0, self.opts.abbrCutoff) + '...' + '</label>'
		},

		get_status_msg() {
			// get message text for the right half pill; may return null
			const gserr = self.validateGroupsetting()
			if (gserr) return gserr

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
		},

		async showEditMenu(div) {
			// grade/subcondtion value type
			const value_type_select = div
				.append('select')
				.style('margin', '5px 10px')
				.property('disabled', self.q.mode == 'binary' ? true : false)
				.on('change', () => {
					// if changed from grade to sub or vice versa, set inuse = false
					if (
						(value_type_select.node().value == 'sub' && self.q.bar_by_grade) ||
						(value_type_select.node().value != 'sub' && self.q.bar_by_children)
					) {
						self.q.groupsetting.predefined_groupset_idx = undefined
						self.q.groupsetting.inuse = false
					}

					self.q.bar_by_grade = value_type_select.node().value == 'sub' ? false : true
					self.q.bar_by_children = value_type_select.node().value == 'sub' ? true : false
					self.q.value_by_max_grade = value_type_select.node().value == 'max' ? true : false
					self.q.value_by_most_recent = value_type_select.node().value == 'recent' ? true : false
					self.q.value_by_computable_grade =
						value_type_select.node().value == 'computable' || value_type_select.node().value == 'sub' ? true : false

					self.dom.tip.hide()
					self.runCallback()
				})

			value_type_select
				.append('option')
				.attr('value', 'max')
				.text('Max grade per patient')

			value_type_select
				.append('option')
				.attr('value', 'recent')
				.text('Most recent grade per patient')

			value_type_select
				.append('option')
				.attr('value', 'computable')
				.text('Any grade per patient')

			value_type_select.node().selectedIndex = self.q.value_by_computable_grade
				? 2
				: self.q.value_by_most_recent
				? 1
				: 0

			//options for grouping grades/subconditions
			self.showGrpOpts(div)
		}
	}
}
