import { dofetch2 } from '../client'

export function getCategoricalMethodsSetter(self) {
	/*** self is a TVS instance, see src/common/tvs.js ***/

	return function setMethods() {
		// will swap out similarly named methods for non-numeric term types;
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
		if (tvs.values.length == 1) {
			// single
			const v = tvs.values[0]
			if (v.label) return v.label
			if (tvs.term.values && tvs.term.values[v.key] && tvs.term.values[v.key].label) return tvs.term.values[v.key].label
			console.error(`key "${v.key}" not found in values{} of ${tvs.term.name}`)
			return v.key
		}
		// multiple
		if (tvs.groupset_label) return tvs.groupset_label
		return tvs.values.length + ' groups'
	}

	async function fillMenu(div, tvs) {
		const data = await getCategories(tvs.term)
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
