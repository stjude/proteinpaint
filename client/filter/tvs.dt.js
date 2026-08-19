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
	// get mutations from dataset. the variant config lists the amino acid changes,
	// so this is one of the few callers that needs the mname tally
	const term = structuredClone(tvs.term)
	await getDtTermValues(term, self.filter, self.opts.vocabApi, { withMnames: true })
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

/*
get mutation classes of dt term, stored in dtTerm.values{}

opts.withMnames: also store the amino acid changes (when present) in dtTerm.mnames[],
and the sample count of each class on dtTerm.values[k].samplecount.
Only the variant config UI reads mnames. The predefined groupset builder does not,
and the dt term it fills is shared by reference with every tvs of every groupset
(see getPredefinedGroupsets() in tw/geneVariant.ts), so an mname tally left on it is
re-serialized once per tvs into the request payload and the saved state. Callers that
render the variant config must opt in; everyone else gets values only.
*/
export async function getDtTermValues(dtTerm, filter, vocabApi, opts = {}) {
	if (vocabApi instanceof FrontendVocab) {
		// frontend vocab, cannot query values from the db. take them from the matching
		// vocab term, which the custom groupset UI seeds with mnames (see makeGroupUI()
		// in termsetting/handlers/geneVariant.ts). falling back to whatever is already
		// on the dt term supports a vocab whose terms carry their own values
		const vocabTerm = vocabApi.vocab?.terms?.find(t => t.id == dtTerm.id)
		if (vocabTerm) dtTerm.values = vocabTerm.values
		// the tally is only assigned on opt-in, same as the db path below. deliberately
		// NOT deleted otherwise: a frontend vocab cannot re-query it, so a stale tally is
		// preferable to permanently dropping one that an embedder supplied. this is the
		// one asymmetry with the db path, where deleting is free because fillMenu()
		// re-queries before rendering
		if (opts.withMnames && vocabTerm) dtTerm.mnames = vocabTerm.mnames
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
				const value = { key: k, label: vocabApi.termdbConfig.mclass?.[k]?.label || mclass[k].label }
				// the per-class sample tally is only displayed by the variant config UI,
				// so it rides on the same opt-in as mnames and stays off the dt terms
				// that groupset builders serialize into state
				if (opts.withMnames) value.samplecount = classes[k]
				return [k, value]
			})
	)
	if (!opts.withMnames) {
		// deleted rather than simply left unset, so that a tally carried by a tw of a
		// session saved before mnames became opt-in is also cleared
		delete dtTerm.mnames
		return
	}
	// store amino acid changes (e.g. "G12D") in term.mnames
	// entries are { mname, class, samplecount }, sorted by descending sample count
	const mnames = byOrigin ? data.mnames?.byOrigin?.[dtTerm.origin] : data.mnames
	dtTerm.mnames = mnames?.length ? mnames : undefined
}
