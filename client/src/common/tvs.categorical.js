export function getCategoricalMethods(self) {
	/*** self is a TVS instance, see src/common/tvs.js ***/

	// hoisted functions can be returned out of code sequence
	return {
		term_name_gen,
		get_pill_label,
		getSelectRemovePos,
		fillMenu
	}

	/************************************
	 Functions that require access to 
	 the TVS instance are closured here
	*************************************/

	async function fillMenu(div, tvs) {
		const data = await self.opts.vocabApi.getCategories(tvs.term, self.filter, [])
		const sortedVals = data.lst.sort((a, b) => {
			return b.samplecount - a.samplecount
		})

		// 'Apply' button
		div
			.append('div')
			.style('text-align', 'center')
			.append('div')
			.attr('class', 'apply_btn sja_filter_tag_btn')
			.style('display', 'inline-block')
			.style('border-radius', '13px')
			.style('padding', '7px 15px')
			.style('margin', '5px')
			.style('text-align', 'center')
			.style('font-size', '.8em')
			.style('text-transform', 'uppercase')
			.text('Apply')
			.on('click', () => {
				// update term values by ckeckbox values
				const checked_vals = [...values_table.querySelectorAll('.value_checkbox')]
					.filter(elem => elem.checked)
					.map(elem => elem.value)
				const new_vals = sortedVals.filter(v => checked_vals.includes(v.key))
				const new_tvs = JSON.parse(JSON.stringify(tvs))
				delete new_tvs.groupset_label
				new_tvs.values = new_vals
				self.dom.tip.hide()
				self.opts.callback(new_tvs)
			})

		const values_table = self.makeValueTable(div, tvs, sortedVals).node()
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
	if (tvs.values.length == 1) {
		// single
		const v = tvs.values[0]
		if (v.label) return { txt: v.label }
		if (tvs.term.values && tvs.term.values[v.key] && tvs.term.values[v.key].label)
			return { txt: tvs.term.values[v.key].label }
		console.error(`key "${v.key}" not found in values{} of ${tvs.term.name}`)
		return { txt: v.key }
	}
	// multiple
	if (tvs.groupset_label) return { txt: tvs.groupset_label }
	return { txt: tvs.values.length + ' groups' }
}

function getSelectRemovePos(j) {
	return j
}
