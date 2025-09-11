import { getPillNameDefault, set_hiddenvalues } from '#termsetting'
import { make_radios, sayerror, throwMsgWithFilePathAndFnName } from '#dom'
import { copyMerge } from '#rx'
import type { PillData, RawConditionTW, ConditionQ, VocabApi, TermValues } from '#types'

// grades that can be used for q.breaks, exclude uncomputable ones and 0, thus have to hardcode
// if needed, can define from termdbConfig

const cutoffGrades: number[] = [1, 2, 3, 4, 5]

export function getHandler(self) {
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

		// async postMain() {
		// 	const body = self.opts.getBodyParams?.() || {} //make sure term1_q is added
		// 	const data = await self.vocabApi.getCategories(self.term, self.filter!, body)
		// 	//not really sure this is necessary but it's consistent across other handlers
		// 	self.category2samplecount = []
		// 	for (const d of data.lst) {
		// 		self.category2samplecount.push({
		// 			key: d.key,
		// 			label: d.label,
		// 			count: d.samplecount
		// 		})
		// 		// }
		// 	}
		// }
	}
}

function getPillStatus(self) {
	const text: string | undefined = self.q?.name || self.q?.reuseId
	if (text) return { text }
	if (self.q.mode == 'discrete') {
		if (self.q.breaks?.length) {
			return { text: self.q.breaks.length + 1 + ' groups' }
		} else {
			if (self.q.bar_by_grade) {
				if (self.q.value_by_max_grade) return { text: 'Max. Grade' }
				if (self.q.value_by_most_recent) return { text: 'Most Recent Grade' }
				if (self.q.value_by_computable_grade) return { text: 'Any Grade' }
				return { text: 'Error: unknown grade setting', bgcolor: 'red' }
			}
			if (self.q.bar_by_children) return { text: 'Sub-condition' }
		}
	}
	if (self.q.mode == 'binary') {
		return {
			text:
				self.usecase?.target == 'regression' ? self.data.q.groups.find(x => x.name != self.data.refGrp).name : 'binary'
		}
	}
	if (self.q.mode == 'cuminc' || self.q.mode == 'cox') {
		if (!self.q.breaks || self.q.breaks.length == 0) throwMsgWithFilePathAndFnName('Missing q.breaks')
		return { text: `Grades ${self.q.breaks![0]}-5` }
	}
	return {}
}

async function showMenu_discrete(self, div: any) {
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
			self.api.runCallback()
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
		//await new GroupSettingMethods(Object.assign(self, { newMenu: false })).main()
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
	gradeValuesDiv.append('div').style('margin-bottom', '5px').style('color', 'rgb(136, 136, 136)').text('Cutoff grades')

	const textarea = gradeValuesDiv
		.append('textarea')
		.style('width', '100px')
		.style('height', '70px')
		.on('keyup', textarea2gradeUI)

	// help note
	gradeValuesDiv
		.append('div')
		.style('font-size', '.6em')
		.style('margin-left', '1px')
		.style('color', '#858585')
		.html('Enter numeric values </br>seperated by ENTER')

	if (self.q.breaks?.length) {
		textarea.property('value', self.q.breaks.join('\n'))
	}

	textarea2gradeUI()
	function textarea2gradeUI() {
		rangeNameDiv.selectAll('*').remove()
		const breaks: number[] = textarea2breaks()
		if (!breaks.length) {
			delete self.q.breaks
			delete self.q.groups
			return
		}

		// split grades into groups based on breaks
		// use only computable grades
		// uncomputable grades (i.e. not tested) will be
		// be displayed as excluded categories
		if (!self.term.values) throwMsgWithFilePathAndFnName(`Missing term values`)
		const grades = Object.keys(self.term.values as TermValues)
			.filter(g => !self.term.values?.[g].uncomputable)
			.map(Number)
			.sort((a, b) => a - b)

		const groups: any = getGroups(grades, breaks)

		// render groups as ranges and names
		rangeNameDiv.append('div').style('margin-bottom', '3px').style('color', 'rgb(136, 136, 136)').text('Range')
		rangeNameDiv.append('div').style('margin-bottom', '3px').style('color', 'rgb(136, 136, 136)').text('Label')
		for (const [i, g] of groups.entries()) {
			// range
			rangeNameDiv.append('div').text(g.name.replace(/Grades* /, ''))

			// name
			rangeNameDiv
				.append('div')
				.append('input')
				.attr('type', 'text')
				.property('value', g.name)
				.style('margin', '2px 0px')
				.on('change', function (this: any) {
					groups[i].name = this.value
				})
		}

		self.q.breaks = breaks
		self.q.groups = groups
	}

	function textarea2breaks() {
		const str = textarea.property('value').trim()
		if (!str) return []
		const lst: any = [...new Set(str.split('\n'))]
		const breaks: number[] = []
		for (const x of lst) {
			const b = Number(x)
			if (!Number.isInteger(b)) {
				sayerror(div, 'cutoff grade must be an integer value')
				return []
			}
			if (b < 1 || b > 5) {
				sayerror(div, `cutoff grade must be within grades 1-5`)
				return []
			}
			breaks.push(b)
		}
		if (!breaks.length) return []
		return breaks.sort((i: number, j: number) => i - j)
	}

	// Apply button
	div
		.append('button')
		.text('Apply')
		.style('margin', '10px')
		.on('click', (event: any) => {
			event.target.disabled = true
			event.target.innerHTML = 'Loading...'
			// (event.target as HTMLButtonElement).disabled = true
			// (event.target as HTMLButtonElement).innerHTML = 'Loading...'
			self.api.runCallback()
		})
}

function showMenu_cutoff(self, div: any) {
	const holder = div
		.append('div')
		.style('margin', '10px')
		.style('display', 'grid')
		.style('grid-template-columns', 'auto auto')
		.style('gap', '20px')

	// row 1
	holder.append('div').text('Grade cutoff').style('opacity', 0.4)
	const sd = holder.append('div')
	const gradeSelect = sd.append('select').on('change', changeGradeSelect)
	for (const i of cutoffGrades) {
		gradeSelect.append('option').text(self.term.values?.[i].label)
	}
	// breaks[0] must have already been set
	gradeSelect.property('selectedIndex', self.q.breaks![0] - 1)

	// row 2
	holder
		.append('div')
		.text(self.q.mode == 'binary' ? 'Group 1' : 'Censored')
		.style('opacity', 0.4)
	const g1n = holder.append('div').style('opacity', 0.4)

	// row 3
	holder
		.append('div')
		.text(self.q.mode == 'binary' ? 'Group 2' : 'Event')
		.style('opacity', 0.4)
	const g2n = holder.append('div').style('opacity', 0.4)

	changeGradeSelect()

	function changeGradeSelect() {
		const grade = gradeSelect.property('selectedIndex') + 1
		g1n.selectAll('*').remove()
		g2n.selectAll('*').remove()
		const grades = Object.keys(self.term.values as TermValues)
			.map(Number)
			.sort((a, b) => a - b)
		for (const i of grades) {
			if (i < grade) {
				g1n.append('div').text(self.term.values?.[i].label)
			} else {
				g2n.append('div').text(self.term.values?.[i].label)
			}
		}
	}

	// row 4: time scale toggle (for cox outcome)
	const timeUnit = self.vocabApi.termdbConfig.timeUnit
	let timeScaleChoice: 'age' | 'time'
	if (self.q.mode == 'cox') {
		timeScaleChoice = self.q.timeScale
		holder.append('div').text('Time axis').style('opacity', 0.4)
		const options: { label: string; value: string; checked?: boolean }[] = [
			{
				label: timeUnit.charAt(0).toUpperCase() + timeUnit.slice(1),
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
			styles: { padding: '' },
			callback: (v: 'age' | 'time') => (timeScaleChoice = v)
		})
	}

	// apply button
	div
		.append('button')
		.text('Apply')
		.style('margin', '10px')
		.on('click', (event: any) => {
			if (!self.q.breaks || self.q.breaks.length == 0) throwMsgWithFilePathAndFnName('Missing q.breaks')
			const grade = gradeSelect.property('selectedIndex') + 1
			self.q.breaks![0] = grade
			if (self.q.mode == 'binary') {
				// split grades into groups based on breaks
				// include both tested and not tested grades
				const grades = Object.keys(self.term.values as TermValues)
					.map(Number)
					.sort((a, b) => a - b)
				self.q.groups = getGroups(grades, self.q.breaks!)
				self.refGrp = self.q.groups[0].name
			}
			if (self.q.mode == 'cox') self.q.timeScale = timeScaleChoice
			event.target.disabled = true
			event.target.innerHTML = 'Loading...'
			// (event.target as HTMLButtonElement).disabled = true
			// (event.target as HTMLButtonElement).innerHTML = 'Loading...'
			self.api.runCallback()
		})
}

// split grades into groups based on breaks
function getGroups(grades: number[], breaks: number[]) {
	grades.sort((a, b) => a - b)
	type GroupEntry = { name: string; values: (string | number)[] }
	const groups: GroupEntry[] = [] // [ {name, values}, {name, values} ]
	let group: any = { values: [] }
	let b: any
	for (const g of grades) {
		if (breaks.includes(g)) {
			b = g
			// new break in grades
			// modify name of previously iterated group
			const max = Math.max(...group.values)
			if (!groups.length) {
				// first group of groups[]
				if (group.values.length == 1) {
					// single value in group
					// should be grade 0
					if (group.values[0] !== 0) throw 'unexpected group value'
					group.name = 'Grade 0'
				} else {
					// multiple values in group
					if (group.values.length == 2 && group.values.includes(-1) && group.values.includes(0)) {
						group.name = 'Not tested/Grade 0'
					} else {
						group.name = group.values.includes(-1) ? `Not tested/Grade 0 - Grade ${max}` : `Grades 0-${max}`
					}
				}
			} else {
				// interior group of groups[]
				group.name = group.values.length == 1 ? `Grade ${group.values[0]}` : `${group.name}-${max}`
			}
			// add previously iterated group to groups[]
			groups.push(group)
			// create new group of grades based on new break
			group = {
				name: `Grade ${b}`,
				values: [g]
			}
		} else {
			// add grade to group of grades
			group.values.push(g)
		}
	}
	// add last group of groups[]
	group.name = `Grades ${b}-5`
	groups.push(group)
	return groups
}

export function fillTW(tw: RawConditionTW, vocabApi: VocabApi, defaultQ: ConditionQ) {
	set_hiddenvalues(tw.q as ConditionQ, tw.term)

	if (defaultQ) {
		// apply predefined settings
		copyMerge(tw.q, defaultQ)
	}

	// assign default if missing
	if (!Object.keys(tw.q).includes('mode')) tw.q.mode = 'discrete'

	if (!tw.q.valueFor) {
		// TODO: always use discriminant properties and remove the need for boolean flags
		// that break expectations for mutually-exclusive-values, so that the workarounds
		// in this code block will not be needed
		const q = tw.q as any
		if (!q.bar_by_grade && !q.bar_by_children) q.bar_by_grade = true satisfies boolean
		;(tw.q as any).valueFor = (tw.q as any).bar_by_children ? 'children' : 'grade'
	}

	// must set up bar/value flags before quiting for inuse:false
	if (tw.q.valueFor == 'grade') {
		// TODO: replace with tw.q.valueBy or tw.q.restriction
		if (tw.q.value_by_max_grade || tw.q.value_by_most_recent || tw.q.value_by_computable_grade) {
			// need any of the three to be set
		} else {
			// set a default one
			tw.q.value_by_max_grade = true
		}
	}

	// assign breaks
	if (tw.q.mode == 'binary' || tw.q.mode == 'cox' || tw.q.mode == 'cuminc') {
		// must have a single break
		const defaultBreak = tw.q.mode == 'binary' ? 1 : 3
		if (!tw.q.breaks?.length) tw.q.breaks = [defaultBreak]
		if (tw.q.breaks.length != 1 || ![1, 2, 3, 4, 5].includes(tw.q.breaks[0])) throw 'invalid tw.q.breaks'
	}

	// assign groups based on breaks
	if (tw.q.valueFor == 'grade') {
		if (tw.q.breaks?.length) {
			if (!tw.term.values) throw 'missing term.values'
			if (tw.q.mode == 'discrete' || tw.q.mode == 'binary') {
				// only assign groups to discrete and binary terms
				// for cuminc and cox terms, groups will be determined in sql query

				// term.values is treated optional so tsc won't complain

				const grades = Object.keys(tw.term.values)
					.filter(g => (tw.q.mode == 'discrete' ? !tw.term.values?.[g].uncomputable : g))
					.map(Number)
					.sort((a, b) => a - b)

				tw.q.groups = getGroups(grades, tw.q.breaks)
			}
		}

		// cox time scale
		if (tw.q.mode == 'cox') {
			if (!tw.q.timeScale) tw.q.timeScale = 'time'
			if (!['age', 'time'].includes(tw.q.timeScale)) throw 'invalid q.timeScale'
		}
	}
}
