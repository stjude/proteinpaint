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
validateCategoricalTvs()

*/

export const handler = {
	type: 'survival',
	term_name_gen,
	get_pill_label,
	getSelectRemovePos,
	fillMenu,
	setTvsDefaults
}

let cutoff
async function fillMenu(self, div, tvs) {
	const data = await self.opts.vocabApi.getCategories(tvs.term, self.filter, self.opts.getCategoriesArguments || {})
	const sortedVals = data.lst.sort((a, b) => {
		return b.samplecount - a.samplecount
	})
	const cutoffDiv = div
		.append('div')
		.style('font-size', '0.8em')
		.style('padding-left', '4px')
	const cutoffInput = cutoffDiv
		.append('input')
		.attr('type', 'number')
		.style('width', '40px')
		.attr('min', 0)
		.attr('max', 50)
		.on('change', () => label.text(cutoffInput.node().value == '1' ? 'year after' : 'years after'))

	const label = cutoffDiv.append('label').text('years after')
	if (tvs.q?.cutoff) {
		cutoff = tvs.q.cutoff
		cutoffInput.node().value = cutoff
	}
	const tableCallback = indexes => {
		//update term values by ckeckbox values

		// for categorical terms, force v.key to a string
		const new_tvs = JSON.parse(JSON.stringify(tvs))
		delete new_tvs.groupset_label
		new_tvs.values = sortedVals.filter((v, index, array) => indexes.includes(index))
		cutoff = cutoffInput.node().value
		if (cutoff) new_tvs.q = { cutoff }
		else new_tvs.q = {}
		try {
			validateCategoricalTvs(new_tvs)
		} catch (e) {
			window.alert(e)
			return
		}
		self.dom.tip.hide()
		self.opts.callback(new_tvs)
	}

	const tableDiv = div.append('div')
	const values_table = self.makeValueTable(tableDiv, tvs, sortedVals, tableCallback).node()
}

function term_name_gen(d) {
	const name = d.term.name
	return name.length < 21 ? name : '<label title="' + name + '">' + name.substring(0, 18) + '...' + '</label>'
}

function get_pill_label(tvs) {
	let txt
	if (tvs.values.length == 1) {
		// single
		const v = tvs.values[0]
		if (v.label) txt = v.label
		else {
			const value = tvs.term.values?.[v.key]
			if (value) {
				txt = value.key || value.label
			}
		}
		if (!txt) {
			txt = v.key
			console.error(`key "${v.key}" not found in values{} of ${tvs.term.name}`)
		}
	} else {
		// multiple
		if (tvs.groupset_label) txt = tvs.groupset_label
		else txt = tvs.values.length + ' groups'
	}
	if (cutoff) txt = `${txt} (${cutoff == '1' ? '1 year later' : cutoff + ' years later'})`
	return { txt }
}

function getSelectRemovePos(j) {
	return j
}

function setTvsDefaults(tvs) {
	if (!tvs.values) tvs.values = []
}

function validateCategoricalTvs(tvs) {
	if (!tvs.term) throw 'tvs.term is not defined'
	if (!tvs.values) throw `.values[] missing for a term ${tvs.term.name}`
	if (!Array.isArray(tvs.values)) throw `.values[] is not an array for a term ${tvs.term.name}`
	if (!tvs.values.length) throw `no categories selected for ${tvs.term.name}`
	if (!tvs.values.every(v => v.key !== undefined))
		throw `every value in tvs.values[] must have 'key' defined for ${tvs.term.name}`
}
