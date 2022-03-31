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

		showEditMenu(div) {
			if (self.q.mode == 'discrete') return showMenu_discrete(self, div)
			if (self.q.mode == 'binary') return showMenu_binary(self, div)
			throw 'q.mode is not discrete/binary'
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
			if (self.opts.showTimeScale) {
				if (!self.q.timeScale) self.q.timeScale = 'year' // TODO change to time2event
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

function showMenu_discrete(self, div) {
	const value_type_select = div
		.append('select')
		.style('margin', '10px')
		.style('display', 'block')
		.property('disabled', self.q.mode == 'binary' ? true : false)
		.on('change', () => {
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

	// TODO may hide holder if q is not max/recent grade

	const holder = div
		.append('div')
		.style('margin', '10px')
		.style('display', 'grid')
		.style('grid-template-columns', 'auto auto auto')
		.style('gap', '10px')
	const textarea = holder
		.append('div')
		.append('textarea')
		.style('width', '100px')
		.style('height', '100px')
		.on('keyup', () => {})
	const rangeDiv = holder.append('div')
	const nameDiv = holder.append('div')
	if (self.q.breaks.length) {
		textarea.property('value', self.q.breaks.join('\n'))
	}
	textarea2gradeUI()
	function textarea2gradeUI() {
		rangeDiv.selectAll('*')
		nameDiv.selectAll('*')
		const breaks = textarea2breaks()
		if (breaks.length == 0) return
		for (const [i, b1] of breaks.entries()) {
			// each break creates a group
			const rangeCell = rangeDiv.append('div').style('opacity', 0.4)
			const nameCell = nameDiv.append('input').style('display', 'block')
			if (i == 0) {
				rangeCell.text('<' + b1)
				nameCell.property('value', 'Grade <' + b1)
			} else {
				const b0 = breaks[i - 1]
				const str = b1 - b0 == 1 ? b1 : b0 + '-' + b1
				rangeCell.text(str)
				nameCell.text('Grade ' + str)
			}
		}
		// last group
		const b1 = breaks[breaks.length - 1]
		const rangeCell = rangeDiv.append('div').style('opacity', 0.4)
		const nameCell = nameDiv.append('input').style('display', 'block')
		const str = b1 == 5 ? b1 : b1 + '-5'
		rangeCell.text(str)
		nameCell.text('Grade ' + str)
	}

	function textarea2breaks() {
		const str = textarea.property('value').trim()
		if (!str) return []
		const lst = [
			...new Set(
				str
					.split('\n')
					.map(Number)
					.filter(i => Number.isInteger(i) && i >= 1 && i <= 5)
			)
		]
		if (lst.size == 0) return []
		return lst.sort((i, j) => i - j)
	}

	div
		.append('button')
		.text('Submit')
		.style('margin', '10px')
		.on('click', () => {
			self.q.breaks = textarea2breaks()
			self.q.groupNames = []
			nameDiv.selectAll('input') // collect input values into array
			self.runCallback()
		})
}

function showMenu_binary(self, div) {
	div
		.append('div')
		.text('Using maximum grade for each patient.')
		.style('opacity', 0.4)
		.style('margin', '10px')
		.style('font-size', '.7em')

	const holder = div
		.append('div')
		.style('margin', '10px')
		.style('display', 'grid')
		.style('grid-template-columns', '140px 150px')
		.style('gap', '7px')

	// row 1
	holder
		.append('div')
		.text('Cutoff')
		.style('opacity', 0.4)
	const select = holder
		.append('div')
		.append('select')
		.on('change', select2groupname)
	// hardcode grades;/ if needed, can define from termdbConfig
	for (const i of [1, 2, 3, 4, 5]) {
		select.append('option').text(self.term.values[i].label)
	}
	// breaks[0] must have already been set
	select.property('selectedIndex', self.q.breaks[0] - 1)

	// row 2
	holder
		.append('div')
		.text('Group 1 name')
		.style('opacity', 0.4)
	const g1n = holder
		.append('div')
		.append('input')
		.style('width', '130px')

	// row 3
	holder
		.append('div')
		.text('Group 2 name')
		.style('opacity', 0.4)
	const g2n = holder
		.append('div')
		.append('input')
		.style('width', '130px')

	select2groupname()
	if (self.q.groupNames && self.q.groupNames[0]) g1n.property('value', self.q.groupNames[0])
	if (self.q.groupNames && self.q.groupNames[1]) g2n.property('value', self.q.groupNames[1])

	function select2groupname() {
		const grade = select.property('selectedIndex') + 1
		g1n.property('value', 'Grade <' + grade)
		g2n.property('value', 'Grade >=' + grade)
	}

	div
		.append('button')
		.text('Submit')
		.style('margin', '10px')
		.on('click', () => {
			self.q.breaks[0] = select.property('selectedIndex') + 1
			if (!self.q.groupNames) self.q.groupNames = []
			self.q.groupNames[0] = g1n.property('value')
			self.q.groupNames[1] = g2n.property('value')
			self.runCallback()
		})
}
