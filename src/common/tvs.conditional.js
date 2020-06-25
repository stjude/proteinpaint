import { dofetch2 } from '../client'

export function getConditionalMethodsSetter(self) {
	/*** self is a TVS instance, see src/common/tvs.js ***/

	return function setMethods() {
		// will swap out similarly named methods for non-numeric term types
		// the functions declared below are reused, instead of recreated
		// each time the method swapping occurs
		self.term_name_gen = term_name_gen
		self.get_value_text = get_value_text
		self.fillMenu = fillMenu
	}

	function term_name_gen(d) {
		const name = d.term.name
		return name.length < 21 ? name : '<label title="' + name + '">' + name.substring(0, 18) + '...' + '</label>'
	}

	function get_value_text(tvs) {
		if (tvs.bar_by_grade || tvs.bar_by_children) {
			if (tvs.values.length == 1) {
				// single
				return tvs.values[0].label
			}
			// multiple
			if (tvs.groupset_label) return tvs.groupset_label
			return tvs.values.length + (tvs.bar_by_grade ? ' Grades' : 'Subconditions')
		}
		if (tvs.grade_and_child) {
			//TODO
			console.error(term)
			return 'todo'
		}
		throw 'unknown tvs setting for a condition term'
	}

	async function fillMenu(div, tvs) {
		// grade/subcondtion select
		const bar_by_select = div
			.append('select')
			.attr('class', '.value_select')
			.style('display', 'block')
			.style('margin', '5px 10px')
			.style('padding', '3px')
			.on('change', () => {
				const new_tvs = JSON.parse(JSON.stringify(tvs))
				const value = bar_by_select.node().value
				new_tvs.bar_by_grade = value === 'grade'
				new_tvs.bar_by_children = value === 'sub'
				div.selectAll('*').remove()
				fillMenu(div, new_tvs)
			})

		bar_by_select
			.append('option')
			.attr('value', 'grade')
			.text('By Grade')
			.property('selected', tvs.bar_by_grade)

		bar_by_select
			.append('option')
			.attr('value', 'sub')
			.text('By Subcondition')
			.property('selected', tvs.bar_by_children)

		// grade type type
		const grade_type_select = div
			.append('select')
			.attr('class', '.grade_select')
			.style('margin', '5px 10px')
			.style('padding', '3px')
			.style('display', tvs.bar_by_grade ? 'block' : 'none')
			.on('change', () => {
				const new_tvs = JSON.parse(JSON.stringify(tvs))
				const value = grade_type_select.node().value
				new_tvs.bar_by_grade = value !== 'sub'
				new_tvs.bar_by_children = value === 'sub'
				new_tvs.value_by_max_grade = value === 'max'
				new_tvs.value_by_most_recent = value === 'recent'
				new_tvs.value_by_computable_grade = value === 'computable' || value === 'sub'
				self.dom.tip.hide()
				self.opts.callback(new_tvs)
			})

		grade_type_select
			.append('option')
			.attr('value', 'max')
			.text('Max grade per patient')
			.property('selected', tvs.value_by_max_grade)

		grade_type_select
			.append('option')
			.attr('value', 'recent')
			.text('Most recent grade per patient')
			.property('selected', tvs.value_by_most_recent)

		grade_type_select
			.append('option')
			.attr('value', 'computable')
			.text('Any grade per patient')
			.property('selected', tvs.value_by_computable_grade)

		// display note if bar by subcondition selected
		div
			.append('span')
			.style('margin', '5px 10px')
			.style('padding', '3px')
			.style('display', tvs.bar_by_children ? 'block' : 'none')
			.style('color', '#888')
			.html('Using any grade per patient')

		const lst = tvs.bar_by_grade ? ['bar_by_grade=1'] : tvs.bar_by_children ? ['bar_by_children=1'] : []
		lst.push(
			tvs.value_by_max_grade
				? 'value_by_max_grade=1'
				: tvs.value_by_most_recent
				? 'value_by_most_recent=1'
				: tvs.value_by_computable_grade
				? 'value_by_computable_grade=1'
				: null
		)

		const data = await getCategories(tvs.term, lst)

		// 'Apply' button
		div
			.append('div')
			.style('text-align', 'center')
			.append('div')
			.attr('class', 'apply_btn sja_filter_tag_btn')
			.style('display', 'inline-block')
			.style('border-radius', '13px')
			// .style('padding', '7px 15px')
			.style('margin', '5px')
			.style('text-align', 'center')
			.style('font-size', '.9em')
			.style('text-transform', 'uppercase')
			.text('Apply')
			.on('click', () => {
				//update term values by ckeckbox values
				const checked_vals = [...self.values_table.querySelectorAll('.value_checkbox')]
					.filter(elem => elem.checked)
					.map(elem => elem.value)
				const new_vals = data.lst.filter(v => checked_vals.includes(v.key.toString()))
				const new_tvs = JSON.parse(JSON.stringify(tvs))
				delete new_tvs.groupset_label
				new_tvs.values = new_vals
				self.dom.tip.hide()
				self.opts.callback(new_tvs)
			})

		self.values_table = self.makeValueTable(div, tvs, data.lst).node()
	}

	async function getCategories(term, lst = []) {
		const args = [
			'getcategories=1',
			'genome=' + self.genome,
			'dslabel=' + self.dslabel,
			'tid=' + term.id,
			'filter=' + encodeURIComponent(JSON.stringify(self.filter)),
			...lst
		]

		try {
			const data = await dofetch2('/termdb?' + args.join('&'), {})
			if (data.error) throw data.error
			return data
		} catch (e) {
			window.alert(e.message || e)
		}
	}
}
