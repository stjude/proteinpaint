import { handler as _handler } from './tvs.categorical.js'
import { renderVariantConfig } from '#dom'
import { mclass, dtsnvindel } from '#shared/common.js'
import { FrontendVocab } from '#termdb/FrontendVocab'

/*
Base TVS handler for dt terms

TODO: may move dom/variantConfig here
*/

export const handler = Object.assign({}, _handler, { fillMenu, term_name_gen, get_pill_label })

async function fillMenu(self, div, tvs) {
	// get mutations from dataset
	const term = structuredClone(tvs.term)
	await getDtTermValues(term, self.filter, self.opts.vocabApi)
	// render variant config
	const arg = {
		holder: div,
		header: term.parentTerm.name + ' ' + term.name,
		values: term.values,
		selectedValues: tvs.values,
		genotype: tvs.genotype,
		dt: term.dt,
		mcount: tvs.mcount,
		callback: config => {
			const new_tvs = structuredClone(tvs)
			Object.assign(new_tvs, config)
			self.dom.tip.hide()
			self.opts.callback(new_tvs)
		}
	}
	const mafFilter = self.opts.vocabApi.termdbConfig?.queries?.snvindel?.mafFilter
	if (mafFilter && term.dt == dtsnvindel) {
		// maf filter specified in dataset
		mafFilter.active = tvs.mafFilter || mafFilter.filter
		arg.mafFilter = mafFilter
	}
	renderVariantConfig(arg)
}

function term_name_gen(d) {
	const name = d.term.parentTerm && !d.excludeGeneName ? `${d.term.parentTerm.name} ${d.term.name}` : d.term.name
	return name.length < 31 ? name : '<label title="' + name + '">' + name.substring(0, 28) + '...' + '</label>'
}

function get_pill_label(tvs) {
	let txt
	if (tvs.genotype == 'variant') {
		if (tvs.values.length == 1) {
			// single mutation class
			txt = tvs.values[0].label
		} else {
			// multiple mutation classes
			if (tvs.term.dt == 1) txt = 'Mutated'
			else txt = 'Altered'
		}
	} else if (tvs.genotype == 'wt') {
		// wildtype genotype
		txt = 'Wildtype'
	} else if (tvs.genotype == 'nt') {
		// not tested
		txt = 'Not tested'
	} else {
		throw 'tvs.genotype not recognized'
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
