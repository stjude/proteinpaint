import { handler as categoricalHandler } from './tvs.categorical.js'

/*
tvs handler for term type 'multivalue'

membership filtering reuses the categorical checkbox table: getCategories lists
one entry per key (the server expands the {key: number} annotation), the user
checks keys, and the submitted tvs.values[] keys are matched server-side by
get_multivalue() via json_each.

on top of the categorical UI, a join selector chooses whether a sample must
belong to ANY (tvs.join='or', default) or ALL (tvs.join='and') of the checked
categories, since a sample can be a member of several categories at once.
*/

export const handler = Object.assign({}, categoricalHandler, {
	type: 'multivalue',
	get_pill_label,
	fillMenu,
	setTvsDefaults
})

async function fillMenu(self, div, tvs) {
	const data = await self.opts.vocabApi.getCategories(tvs.term, self.filter, self.opts.getCategoriesArguments || {})
	const sortedVals = data.lst.sort((a, b) => {
		return b.samplecount - a.samplecount
	})

	// any/all join selector; only meaningful when 2+ categories are checked
	const joinDiv = div.append('div').style('margin', '10px 10px 0px 10px').style('font-size', '.9em')
	joinDiv.append('span').style('opacity', 0.6).text('Sample belongs to ')
	const joinSelect = joinDiv.append('select')
	joinSelect.append('option').attr('value', 'or').text('any')
	joinSelect.append('option').attr('value', 'and').text('all')
	joinSelect.property('value', tvs.join == 'and' ? 'and' : 'or')
	joinDiv.append('span').style('opacity', 0.6).text(' of the checked categories')

	const callback = indexes => {
		// update term values by checkbox selections
		const new_tvs = JSON.parse(JSON.stringify(tvs))
		delete new_tvs.groupset_label
		new_tvs.values = sortedVals.filter((v, index) => indexes.includes(index))
		new_tvs.join = joinSelect.property('value')
		try {
			validateMultivalueTvs(new_tvs)
		} catch (e) {
			window.alert(e)
			return
		}
		self.dom.tip.hide()
		self.opts.callback(new_tvs)
	}

	self.makeValueTable(div, tvs, sortedVals, callback)
}

function get_pill_label(tvs) {
	if (tvs.values.length == 1) {
		// single category, same label logic as categorical
		return categoricalHandler.get_pill_label(tvs)
	}
	return { txt: `${tvs.values.length} groups (${tvs.join == 'and' ? 'all' : 'any'})` }
}

function setTvsDefaults(tvs) {
	if (!tvs.values) tvs.values = []
	if (!tvs.join) tvs.join = 'or'
}

function validateMultivalueTvs(tvs) {
	if (!tvs.term) throw 'tvs.term is not defined'
	if (!tvs.values) throw `.values[] missing for a term ${tvs.term.name}`
	if (!Array.isArray(tvs.values)) throw `.values[] is not an array for a term ${tvs.term.name}`
	if (!tvs.values.length) throw `no categories selected for ${tvs.term.name}`
	if (!tvs.values.every(v => v.key !== undefined))
		throw `every value in tvs.values[] must have 'key' defined for ${tvs.term.name}`
	if (tvs.values.length > 1 && tvs.join != 'or' && tvs.join != 'and')
		throw `invalid tvs.join='${tvs.join}' for ${tvs.term.name}`
}
