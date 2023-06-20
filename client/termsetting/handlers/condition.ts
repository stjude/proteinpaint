import { getPillNameDefault, set_hiddenvalues } from '#termsetting'
import { make_radios } from '#dom/radiobutton'
import { keyupEnter } from '#src/client'
import { copyMerge } from '#rx'
import { PillData, TW, Q, VocabApi } from '#shared/types'

// grades that can be used for q.breaks, exclude uncomputable ones and 0, thus have to hardcode
// if needed, can define from termdbConfig
const cutoffGrades: number[] = [1, 2, 3, 4, 5]
const not_tested_grade: number = -1

export function getHandler(self: any) {
	return {
		getPillName(d: PillData) {
			return getPillNameDefault(self, d)
		},

		getPillStatus() {
			return getPillStatus(self)
		},

		showEditMenu(div: string) {
			if (self.q.mode == 'discrete') {
				// barchart, cuminc term0/2
				return showMenu_discrete(self, div)
			}
			if (self.q.mode == 'binary' || self.q.mode == 'cuminc' || self.q.mode == 'cox') {
				// logistic outcome, cuminc term1, or cox outcome
				// all use a single grade cutoff
				return showMenu_cutoff(self, div)
			}
			console.error('invalid q.mode:', self.q.mode)
			throw 'invalid q.mode'
		}
	}
}

function getPillStatus(self: any) {
	const text: string = self.q?.name || self.q?.reuseId
	if (text) return { text }
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
	if (self.q.mode == 'binary' || self.q.mode == 'cuminc' || self.q.mode == 'cox')
		return { text: 'Grades ' + self.q.breaks[0] + '-5' }
	return { text: 'Error: unknown q.mode', bgcolor: 'red' }
}

function showMenu_discrete(self: any, div: any) {
	// div for selecting type of grade
	const value_type_div = div
		.append('div')
		.style('margin', '10px 0px 10px 5px')
		.style('border-left', 'solid 1px #ededed')

	value_type_div
		.append('div')
		.style('display', 'inline-block')
		.style('margin', '0px 0px 5px 5px')
		.style('color', 'rgb(136, 136, 136)')
		.text('Grade type:')

	const value_type_select = value_type_div
		.append('select')
		.style('display', 'inline')
		.style('margin', '0px 10px')
		.on('change', () => {
			const i = value_type_select.property('selectedIndex')
			self.q.bar_by_grade = i != 3
			self.q.bar_by_children = i == 3
			self.q.value_by_max_grade = i == 0
			self.q.value_by_most_recent = i == 1
			self.q.value_by_computable_grade = i == 2 || i == 3
			self.dom.tip.hide()
			self.runCallback()
		})
	// 0
	value_type_select.append('option').text('Max grade per patient')
	// 1
	value_type_select.append('option').text('Most recent grade per patient')
	// 2
	value_type_select.append('option').text('Any grade per patient')
	// 3
	if (self.term.subconditions) {
		// only show 4th option when subconditions are available
		value_type_select.append('option').text('Sub-conditions')
	}
	value_type_select.property(
		'selectedIndex',
		self.q.bar_by_children ? 3 : self.q.value_by_computable_grade ? 2 : self.q.value_by_most_recent ? 1 : 0
	)

	if (self.q.bar_by_children) {
		// do not show grade cutoff input
		return
	}

	// div for entering cutoff grades
	const breaksSelectorDiv = div
		.append('div')
		.style('margin', '20px 0px 10px 5px')
		.style('border-left', 'solid 1px #ededed')

	breaksSelectorDiv
		.append('div')
		.text('Divide grades into groups (optional):')
		.style('margin', '0px 0px 10px 5px')
		.style('color', 'rgb(136, 136, 136)')

	const holder = breaksSelectorDiv
		.append('div')
		.style('display', 'flex')
		.style('align-items', 'start')
		.style('margin-left', '10px')
		.style('width', '100%')

	// gradeValuesDiv for entering grade values
	// rangeNameDiv for rendering ranges and labels
	const gradeValuesDiv = holder.append('div').style('margin-right', '20px')
	const rangeNameDiv = holder
		.append('div')
		.style('display', 'grid')
		.style('grid-template-columns', 'auto auto')
		.style('column-gap', '20px')
		.style('align-items', 'center')
		.style('margin-right', '5px')

	// TODO replace <textarea> with progressive cutoff selector, may keep using ui components for rangeNameDiv
	gradeValuesDiv
		.append('div')
		.style('margin-bottom', '5px')
		.style('color', 'rgb(136, 136, 136)')
		.text('Cutoff grades')

	const textarea = gradeValuesDiv
		.append('textarea')
		.style('width', '100px')
		.style('height', '70px')
		.on('keyup', (event: KeyboardEvent) => {
			if (!keyupEnter(event)) return
			textarea2gradeUI()
		})

	// help note
	gradeValuesDiv
		.append('div')
		.style('font-size', '.6em')
		.style('margin-left', '1px')
		.style('color', '#858585')
		.html('Enter numeric values </br>seperated by ENTER')

	if (self.q.breaks.length) {
		textarea.property('value', self.q.breaks.join('\n'))
	}

	textarea2gradeUI()
	function textarea2gradeUI() {
		rangeNameDiv.selectAll('*').remove()
		const breaks: number[] = textarea2breaks()
		if (breaks.length == 0) return
		rangeNameDiv
			.append('div')
			.style('margin-bottom', '3px')
			.style('color', 'rgb(136, 136, 136)')
			.text('Range')
		rangeNameDiv
			.append('div')
			.style('margin-bottom', '3px')
			.style('color', 'rgb(136, 136, 136)')
			.text('Label')
		for (const [i, b1] of breaks.entries()) {
			// each break creates a group
			const b0 = breaks[i - 1]
			const range = i === 0 ? '<' + b1 : b1 - b0 === 1 ? b0 : b0 + '-' + (b1 - 1)

			// range
			rangeNameDiv.append('div').text(range)

			// name
			rangeNameDiv
				.append('div')
				.append('input')
				.attr('type', 'text')
				.property('value', 'Grade ' + range)
				.style('margin', '2px 0px')
		}
		// last group
		const b1 = breaks[breaks.length - 1]
		const range = b1 == 5 ? b1 : b1 + '-5'
		rangeNameDiv.append('div').text(range)
		rangeNameDiv
			.append('div')
			.append('input')
			.attr('type', 'text')
			.property('value', 'Grade ' + range)
			.style('margin', '2px 0px')

		// name <input> for all groups are created under rangeNameDiv
		// if q.groupNames are there, override
		if (self.q.groupNames) {
			const lst = rangeNameDiv.selectAll('input').nodes()
			for (const [i, name] of self.q.groupNames.entries()) {
				if (lst[i]) lst[i].value = name
			}
		}
	}

	function textarea2breaks() {
		const str = textarea.property('value').trim()
		if (!str) return []
		const lst: any = [
			...new Set(
				str
					.split('\n')
					.map(Number)
					.filter((i: number) => Number.isInteger(i) && i >= 1 && i <= 5)
			)
		]
		if (lst.size == 0) return []
		return lst.sort((i: number, j: number) => i - j)
	}

	// Apply button
	div
		.append('button')
		.text('Apply')
		.style('margin', '10px')
		.on('click', (event: MouseEvent) => {
			self.q.breaks = textarea2breaks()
			self.q.groupNames = []
			for (const i of rangeNameDiv.selectAll('input').nodes()) {
				self.q.groupNames.push(i.value)
			}
			(event.target as HTMLButtonElement).disabled = true;
			(event.target as HTMLButtonElement).innerHTML = 'Loading...'
			self.runCallback()
		})
}

function showMenu_cutoff(self: any, div: any) {
	const holder = div
		.append('div')
		.style('margin', '10px')
		.style('display', 'grid')
		.style('grid-template-columns', 'auto auto')
		.style('gap', '20px')

	// row 1
	holder
		.append('div')
		.text('Grade cutoff')
		.style('opacity', 0.4)
	const sd = holder.append('div')
	const gradeSelect = sd.append('select').on('change', changeGradeSelect)
	for (const i of cutoffGrades) {
		gradeSelect.append('option').text(self.term.values[i].label)
	}
	// breaks[0] must have already been set
	gradeSelect.property('selectedIndex', self.q.breaks[0] - 1)

	// row 2
	holder
		.append('div')
		.text(self.q.mode == 'binary' ? 'Group 1' : 'No event / censored')
		.style('opacity', 0.4)
	const g1n = holder.append('div').style('opacity', 0.4)

	// row 3
	holder
		.append('div')
		.text(self.q.mode == 'binary' ? 'Group 2' : 'Has event')
		.style('opacity', 0.4)
	const g2n = holder.append('div').style('opacity', 0.4)

	changeGradeSelect()

	function changeGradeSelect() {
		const grade = gradeSelect.property('selectedIndex') + 1
		g1n.selectAll('*').remove()
		g2n.selectAll('*').remove()
		const grades = Object.keys(self.term.values)
			.map(Number)
			.sort((a, b) => a - b)
		for (const i of grades) {
			if (i < grade) {
				g1n.append('div').text(self.term.values[i].label)
			} else {
				g2n.append('div').text(self.term.values[i].label)
			}
		}
	}

	// row 4: time scale toggle (for cox outcome)
	let timeScaleChoice: string
	if (self.q.mode == 'cox') {
		timeScaleChoice = self.q.timeScale
		holder
			.append('div')
			.text('Time axis')
			.style('opacity', 0.4)
		const options: { label: string, value: string, checked?: boolean }[] = [
			{
				label: 'Years since entry into the cohort', // may define from ds
				value: 'time'
			},
			{ label: 'Age', value: 'age' }
		]
		if (self.q.timeScale == 'age') {
			options[1].checked = true
		} else {
			options[0].checked = true
		}
		make_radios({
			holder: holder.append('div'),
			options,
			styles: { margin: '' },
			callback: (v: string) => (timeScaleChoice = v)
		})
	}

	// apply button
	div
		.append('button')
		.text('Apply')
		.style('margin', '10px')
		.on('click', (event: MouseEvent ) => {
			const grade = gradeSelect.property('selectedIndex') + 1
			self.q.breaks[0] = grade
			if (self.q.mode == 'binary') {
				self.q.groupNames[0] = 'Grade < ' + grade
				self.q.groupNames[1] = 'Grade >= ' + grade
			}
			if (self.q.mode == 'cox') {
				self.q.groupNames[0] = 'No event / censored'
				self.q.groupNames[1] = `Event (grade >= ${grade})`
				self.q.timeScale = timeScaleChoice
			}
			(event.target as HTMLButtonElement).disabled = true;
			(event.target as HTMLButtonElement).innerHTML = 'Loading...'
			self.runCallback()
		})
}

export function fillTW(tw: TW, vocabApi: VocabApi, defaultQ: Q) {
	set_hiddenvalues(tw.q, tw.term)

	if (defaultQ) {
		// apply predefined settings
		copyMerge(tw.q, defaultQ)
	}

	// assign default if missing
	if (!tw.q.mode) tw.q.mode = 'discrete'

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

	// assign breaks and group names
	if (!tw.q.breaks) tw.q.breaks = []
	if (!tw.q.groupNames) tw.q.groupNames = []
	if (tw.q.mode == 'binary' || tw.q.mode == 'cox' || tw.q.mode == 'cuminc') {
		// must have a single break
		const defaultBreak = tw.q.mode == 'binary' ? 1 : 2 // hardcode for now
		if (!tw.q.breaks || tw.q.breaks.length == 0) tw.q.breaks = [defaultBreak]
		if (tw.q.breaks.length != 1 || ![1, 2, 3, 4, 5].includes(tw.q.breaks[0])) throw 'invalid tw.q.breaks'
		if (tw.q.mode == 'binary' || tw.q.mode == 'cox') {
			// assign group names for binary and cox terms
			if (!tw.q.groupNames || tw.q.groupNames.length == 0) {
				if (tw.q.mode == 'binary') {
					tw.q.groupNames[0] = 'Grade < ' + tw.q.breaks[0]
					tw.q.groupNames[1] = 'Grade >= ' + tw.q.breaks[0]
				}
				if (tw.q.mode == 'cox') {
					tw.q.groupNames[0] = 'No event / censored'
					tw.q.groupNames[1] = `Event (grade >= ${tw.q.breaks[0]})`
				}
			}
			if (tw.q.groupNames.length != 2) throw 'invalid tw.q.groupNames'
		}
	}
	if (tw.q.breaks.length >= cutoffGrades.length) throw 'too many values from tw.q.breaks[]'

	// cox time scale
	if (tw.q.mode == 'cox') {
		if (!tw.q.timeScale) tw.q.timeScale = 'time'
		if (!['age', 'time'].includes(tw.q.timeScale)) throw 'invalid q.timeScale'
	}
}