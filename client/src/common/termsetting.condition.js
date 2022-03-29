import { setCategoryConditionMethods } from './termsetting.categorical'
import { setGroupsettingMethods } from './termsetting.groupsetting'
import { getPillNameDefault } from './termsetting'
export { fillTW } from './termsetting.categorical'

/*
********************** EXPORTED
getHandler(self)
	- self: a termsetting instance
	showEditMenu(div) // categorical edit menu
		showGrpOpts // create first menu with basic options e.g. groupset, predefined groupset
	getPillName() // Print term name in the pill
	getPillStatus() // Returns {text, bgcolor} which determines whether to make right half of the pill visible and show some text. Optional bgcolor can be used to highlight an error.
                    // Return null to hide the right half.
********************** INTERNAL

*/

export function getHandler(self) {
	setGroupsettingMethods(self)
	setCategoryConditionMethods(self)

	return {
		getPillName(d) {
			return getPillNameDefault(self, d)
		},

		getPillStatus() {
			// get message text for the right half pill; may return null
			const gserr = self.validateGroupsetting()
			if (gserr) return gserr

			if (self.q.bar_by_grade) {
				if (self.q.value_by_max_grade) return { text: 'Max. Grade' }
				if (self.q.value_by_most_recent) return { text: 'Most Recent Grade' }
				if (self.q.value_by_computable_grade) return { text: 'Any Grade' }
				return { text: 'Error: unknown grade setting', bgcolor: 'red' }
			}
			if (self.q.bar_by_children) {
				return { text: 'Sub-condition' }
			}
			return { text: 'Error: unknown setting for term.type == "condition"', bgcolor: 'red' }
		},

		async showEditMenu(div) {
			// grade/subcondtion value type
			self.q.mode = 'cutoff'
			if (self.q.mode == 'cutoff') {
			} else {
				// TODO: separate into a function
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

				value_type_select
					.append('option')
					.attr('value', 'sub')
					.text('Sub-conditions')

				value_type_select.node().selectedIndex = self.q.bar_by_children
					? 3
					: self.q.value_by_computable_grade
					? 2
					: self.q.value_by_most_recent
					? 1
					: 0
			}
			//options for grouping grades/subconditions
			self.showGrpOpts(div)
		}
	}
}
