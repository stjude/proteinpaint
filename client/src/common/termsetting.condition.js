import { getPillNameDefault, set_hiddenvalues } from './termsetting'

export function getHandler(self) {
	return {
		getPillName(d) {
			return getPillNameDefault(self, d)
		},

		getPillStatus() {
			if (self.q.mode == 'discrete') {
				if (self.q.breaks.length == 0) {
					if (self.q.bar_by_grade) {
						if (self.q.value_by_max_grade) return { text: 'Max. Grade' }
						if (self.q.value_by_most_recent) return { text: 'Most Recent Grade' }
						if (self.q.value_by_computable_grade) return { text: 'Any Grade' }
						return { text: 'Error: unknown grade setting', bgcolor: 'red' }
					}
					if (self.q.bar_by_children) return { text: 'Sub-condition' }
				} else {
					return { text: self.q.breaks.length + 1 + ' groups' }
				}
			}
			if (self.q.mode == 'binary') return { text: 'Grades ' + self.q.breaks[0] + '-5' }
			return { text: 'Error: unknown q.mode', bgcolor: 'red' }
		},

		async showEditMenu(div) {
			// grade/subcondtion value type
			if (self.q.mode == 'discrete') {
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
			} else {
				div.append('span').text('show binary ui')
			}
		},

		validateQ(data) {
			// upon getting a new condition term,
			// take the chance to set conditionMode from constructor option to q{}
			// so it's ready to be used in edit UI and server request
			self.q.mode = self.opts.conditionMode
			if (!self.q.breaks) self.q.breaks = []
			if (!self.q.groupNames) self.q.groupNames = []
			if (self.q.mode == 'binary') {
				if (self.q.breaks.length != 1) {
					self.q.breaks = [1] // HARDCODED
					self.q.groupNames = ['Grade <1', 'Grade >=1']
				}
			}
		}
	}
}

export function fillTW(tw, vocabApi) {
	set_hiddenvalues(tw.q, tw.term)
	// must set up bar/value flags before quiting for inuse:false
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
