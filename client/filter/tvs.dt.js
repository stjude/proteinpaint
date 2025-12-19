import { handler as _handler } from './tvs.categorical.js'
import { renderVariantConfig } from '#dom'
import { mclass } from '#shared/common.js'

/*
Base TVS handler for dt terms
*/

export const handler = Object.assign({}, _handler, { fillMenu, term_name_gen, get_pill_label })

async function fillMenu(self, div, tvs) {
	// get the dt mutations of gene in dataset
	const values = await getDtValues(tvs.term, self.opts.vocabApi)
	// render mutations
	const arg = {
		holder: div,
		values,
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

export async function getDtValues(dtTerm, vocabApi) {
	const termdbmclass = vocabApi.termdbConfig.mclass // custom mclass labels from dataset
	const filter = vocabApi.state.termfilter.filter
	const categories = await vocabApi.getCategories(dtTerm.parentTerm, filter)
	const data = categories.lst.find(x => x.dt == dtTerm.dt)
	if (!data) throw 'dt categories not found'
	const byOrigin = vocabApi.termdbConfig.assayAvailability?.byDt[dtTerm.dt]?.byOrigin
	const classes = byOrigin ? data.classes.byOrigin[dtTerm.origin] : data.classes
	const values = Object.keys(classes)
		.filter(k => k != 'Blank' && k != 'WT')
		.map(k => {
			return { key: k, label: termdbmclass?.[k]?.label || mclass[k].label, value: k }
		})
	return values
}
