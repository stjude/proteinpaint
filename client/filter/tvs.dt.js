import { handler as _handler } from './tvs.categorical.js'
import { renderVariantConfig } from '#dom'

/*
Base TVS handler for dt terms
*/

export const handler = Object.assign({}, _handler, { fillMenu, term_name_gen, get_pill_label })

async function fillMenu(self, div, tvs) {
	// render variant config
	const data = await self.opts.vocabApi.getCategories(tvs.term, self.filter, self.opts.getCategoriesArguments || {})
	const arg = {
		holder: div,
		values: data.lst,
		selectedValues: tvs.values,
		dt: tvs.term.dt,
		mcount: tvs.mcount,
		wt: tvs.wt,
		callback: config => {
			const new_tvs = structuredClone(tvs)
			Object.assign(new_tvs, config)
			self.dom.tip.hide()
			self.opts.callback(new_tvs)
		}
	}
	renderVariantConfig(arg)
}

function term_name_gen(d) {
	const name = d.term.parentTerm && !d.excludeGeneName ? `${d.term.parentTerm.name} ${d.term.name}` : d.term.name
	return name.length < 31 ? name : '<label title="' + name + '">' + name.substring(0, 28) + '...' + '</label>'
}

function get_pill_label(tvs) {
	let txt
	if (tvs.wt) {
		// wildtype genotype
		txt = 'Wildtype'
	} else if (tvs.values.length == 1) {
		// single mutation class
		txt = tvs.values[0].label
	} else {
		// multiple mutation classes
		if (tvs.term.dt == 1) txt = 'Mutated'
		else txt = 'Altered'
	}
	return { txt }
}
