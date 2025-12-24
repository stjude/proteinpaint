import { handler as _handler } from './tvs.categorical.js'
import { renderVariantConfig } from '#dom'
import { mclass } from '#shared/common.js'
import { FrontendVocab } from '#termdb/FrontendVocab'

/*
Base TVS handler for dt terms
*/

export const handler = Object.assign({}, _handler, { fillMenu, term_name_gen, get_pill_label })

async function fillMenu(self, div, tvs) {
	// get mutations of gene in dataset
	const term = structuredClone(tvs.term)
	await getDtTermValues(term, self.filter, self.opts.vocabApi)
	// render mutations
	const arg = {
		holder: div,
		values: term.values,
		selectedValues: tvs.values,
		dt: term.dt,
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

// get mutation classes of dt term
// will store these classes in term.values
export async function getDtTermValues(dtTerm, filter, vocabApi) {
	if (vocabApi instanceof FrontendVocab) {
		// geneVariant frontend vocab, cannot get values from db
		// use values already present on dt term
		return
	}
	// get mutation classes of gene
	const categories = await vocabApi.getCategories(dtTerm.parentTerm, filter)
	// filter for mutations of specific dt
	const data = categories.lst.find(x => x.dt == dtTerm.dt)
	if (!data) return
	const byOrigin = vocabApi.termdbConfig.assayAvailability?.byDt[dtTerm.dt]?.byOrigin
	const classes = byOrigin ? data.classes.byOrigin[dtTerm.origin] : data.classes
	// store mutation classes in term.values
	dtTerm.values = Object.fromEntries(
		Object.keys(classes)
			.filter(k => k != 'Blank' && k != 'WT')
			.map(k => {
				return [k, { key: k, label: vocabApi.termdbConfig.mclass?.[k]?.label || mclass[k].label }]
			})
	)
}
