import { handler as _handler } from './tvs.categorical.js'
import { renderVariantConfig, breakpointRangeLabel } from '#dom'
import { mclass, dtsnvindel, dtsv, dtfusionrna } from '#shared/common.js'
import { FrontendVocab } from '#termdb/FrontendVocab'
import { dofetch3 } from '#common/dofetch'

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
		mnames: term.mnames,
		selectedValues: tvs.values,
		genotype: tvs.genotype,
		dt: term.dt,
		mcount: tvs.mcount,
		callback: config => {
			const new_tvs = structuredClone(tvs)
			Object.assign(new_tvs, config)
			// a cleared breakpoint range is undefined in config, so must be deleted
			// rather than left as the value cloned from the previous tvs
			if (!new_tvs.selfBreakpointRange) delete new_tvs.selfBreakpointRange
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
	const genome = self.opts.vocabApi.vocab?.genome
	if ((term.dt == dtsv || term.dt == dtfusionrna) && genome) {
		// sv/fusion events may be restricted to a breakpoint range, which is charted
		// over the isoform models of the gene
		arg.getGeneModels = async gene => {
			const data = await dofetch3('genelookup', { body: { genome, input: gene, deep: 1 } })
			if (data?.error) throw data.error
			return data?.gmlst || []
		}
		// a range on the term's own gene is not scoped to a gene (see BreakpointRange),
		// so is only offered when the term has a single gene
		const genes = term.parentTerm?.genes
		if (genes?.length == 1) arg.gene = genes[0].gene || genes[0].name
		arg.selfBreakpointRange = tvs.selfBreakpointRange
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
		// a breakpoint range restricts which events match, so must show in the pill,
		// otherwise a restricted tvs reads the same as an unrestricted one
		const ranges = []
		if (tvs.selfBreakpointRange) ranges.push(breakpointRangeLabel(tvs.selfBreakpointRange))
		for (const v of tvs.values) {
			if (v.partnerBreakpointRange) ranges.push(breakpointRangeLabel(v.partnerBreakpointRange))
		}
		if (ranges.length) txt += ` @ ${ranges.join(', ')}`
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
// will store these classes in term.values,
// and amino acid changes (when present) in term.mnames
export async function getDtTermValues(dtTerm, filter, vocabApi) {
	if (vocabApi instanceof FrontendVocab) {
		// geneVariant frontend vocab, cannot get values from db
		// use values/mnames already present on dt term
		return
	}

	// get mutation classes of gene
	const body = { term1_q: { dtLst: [dtTerm.dt] } }
	const categories = await vocabApi.getCategories(dtTerm.parentTerm, filter, body)
	// filter for mutations of specific dt
	if (!categories) throw new Error('unable to retrieve variant data')

	// filter for mutations of specific dt
	const data = categories?.lst.find(x => x.dt == dtTerm.dt)
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
	// store amino acid changes (e.g. "G12D") in term.mnames
	// entries are { mname, class, samplecount }, sorted by descending sample count
	const mnames = byOrigin ? data.mnames?.byOrigin?.[dtTerm.origin] : data.mnames
	dtTerm.mnames = mnames?.length ? mnames : undefined
}
