/*
********************** EXPORTED
handler:
	// internal functions as part of handler
	term_name_gen()
	get_pill_label()
	getSelectRemovePos()
	fillMenu()
	setTvsDefaults()

********************** INTERNAL
validateConditionTvs()

*/

export const handler = {
	type: 'condition',
	term_name_gen,
	get_pill_label,
	getSelectRemovePos,
	fillMenu,
	setTvsDefaults
}

async function fillMenu(self, div, tvs) {
	/*** Inactivate the subcondition options for now, default to grade, may reactivate later ***/
	// grade/subcondtion select
	const bar_by_select = div
		.append('select')
		.attr('class', 'value_select')
		.style('display', 'block')
		.style('margin', '5px 10px')
		.style('padding', '3px')
		.on('change', () => {
			const new_tvs = JSON.parse(JSON.stringify(tvs))
			const value = bar_by_select.node().value
			new_tvs.bar_by_grade = value === 'grade'
			new_tvs.bar_by_children = value === 'sub'
			// when switching to 'By grade', default to value_by_max_grade
			if (value === 'grade') {
				new_tvs.value_by_max_grade = true
				delete new_tvs.value_by_most_recent
				delete new_tvs.value_by_computable_grade
			}
			div.selectAll('*').remove()
			fillMenu(self, div, new_tvs)
		})

	bar_by_select.append('option').attr('value', 'grade').text('By Grade').property('selected', tvs.bar_by_grade)

	bar_by_select.append('option').attr('value', 'sub').text('By Subcondition').property('selected', tvs.bar_by_children)

	// grade type type
	const grade_type_select = div
		.append('select')
		.attr('class', 'grade_select')
		.style('margin', '5px 10px')
		.style('padding', '3px')
		.style('display', tvs.bar_by_grade ? 'block' : 'none')
		.on('change', () => {
			const new_tvs = JSON.parse(JSON.stringify(tvs))
			update_value_by(new_tvs)
			div.selectAll('*').remove()
			fillMenu(self, div, new_tvs)
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

	const body = { term1_q: {} }
	for (const key in tvs) {
		if (key.includes('_by_')) body.term1_q[key] = tvs[key]
	}

	const data = await self.opts.vocabApi.getCategories(tvs.term, self.filter, body)
	const callback = indexes => {
		const new_tvs = JSON.parse(JSON.stringify(tvs))
		delete new_tvs.groupset_label
		new_tvs.values = data.lst.filter((v, i, array) => indexes.includes(i))
		// update bar_by_*
		const bar_by_value = bar_by_select.node().value
		new_tvs.bar_by_grade = bar_by_value !== 'sub'
		new_tvs.bar_by_children = bar_by_value === 'sub'
		// update value_by_*
		update_value_by(new_tvs)
		try {
			validateConditionTvs(new_tvs)
		} catch (e) {
			window.alert(e)
			return
		}
		self.dom.tip.hide()
		self.opts.callback(new_tvs)
	}

	self.values_table = self.makeValueTable(div, tvs, data.lst, callback).node()

	function update_value_by(new_tvs) {
		const bar_by_value = bar_by_select.property('value')
		const grade_type_value = grade_type_select.property('value')
		if (bar_by_value === 'sub') {
			new_tvs.value_by_computable_grade = true
			delete new_tvs.value_by_max_grade
			delete new_tvs.value_by_most_recent
		} else {
			new_tvs.value_by_max_grade = grade_type_value === 'max'
			new_tvs.value_by_most_recent = grade_type_value === 'recent'
			new_tvs.value_by_computable_grade = grade_type_value === 'computable'
		}
	}
}

/*****************************************
 Functions that do not require access 
 to the TVS instance are declared below.

 This will help minimize the unnecessary 
 recreation of functions that are not 
 specific to a TVS instance.
******************************************/

function term_name_gen(d) {
	const name = d.term.name
	return name.length < 21 ? name : '<label title="' + name + '">' + name.substring(0, 18) + '...' + '</label>'
}

function get_pill_label(tvs) {
	return {
		txt: get_value_text(tvs),
		grade_type: tvs.bar_by_children
			? ''
			: tvs.value_by_max_grade
			? '[Max Grade]'
			: tvs.value_by_most_recent
			? '[Most Recent Grade]'
			: tvs.value_by_computable_grade
			? '[Any Grade]'
			: ''
	}
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

function getSelectRemovePos(j) {
	return j
}

function setTvsDefaults(tvs) {
	if (!tvs.values) tvs.values = []
	if (!tvs.bar_by_grade && !tvs.bar_by_children_) {
		tvs.bar_by_grade = true
	}
	if (!tvs.value_by_max_grade && !tvs.value_by_most_recent && !tvs.value_by_computable_grade) {
		tvs.value_by_max_grade = true
	}
}

function validateConditionTvs(tvs) {
	if (!tvs.term) throw 'tvs.term is not defined'
	if (!tvs.values) throw `.values[] missing for a term ${tvs.term.name}`
	if (!Array.isArray(tvs.values)) throw `.values[] is not an array for a term ${tvs.term.name}`
	if (!tvs.values.length) throw `no categories selected for ${tvs.term.name}`
	if (!tvs.values.every(v => v.key !== undefined))
		throw `every value in tvs.values[] must have 'key' defined for ${tvs.term.name}`
	if (tvs.term.isleaf == true) {
		if (!tvs.bar_by_grade) throw `tvs.bar_by_grade must be true for leaf term ${tvs.term.name}`
		if (!tvs.value_by_max_grade && !tvs.value_by_most_recent && !tvs.value_by_computable_grade)
			throw `unknown value_type for a bar_by_grade for condition term ${tvs.term.name}`
	} else {
		// non-leaf terms
		if (tvs.bar_by_grade) {
			if (!tvs.value_by_max_grade && !tvs.value_by_most_recent && !tvs.value_by_computable_grade)
				throw `unknown value_type for a bar_by_grade for condition term ${tvs.term.name}`
		} else if (tvs.bar_by_children) {
			if (!tvs.value_by_computable_grade)
				throw `value_type must be value_by_computable_grade for bar_by_children for condition term ${tvs.term.name}`
		} else {
			throw `neither bar_by_grade or bar_by_children is set for a condition term ${tvs.term.name}`
		}
	}
}
