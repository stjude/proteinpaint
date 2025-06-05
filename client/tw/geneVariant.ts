import type {
	GvTerm,
	BaseGroupSet,
	GvValuesQ,
	GvCustomGsQ,
	RawGvValuesTW,
	GvValuesTW,
	RawGvCustomGsTW,
	GvCustomGsTW,
	RawGvTW,
	GvTW,
	FilterGroup,
	VocabApi,
	DtTerm,
	Filter
} from '#types'
import { TwBase, type TwOpts } from './TwBase.ts'
import { copyMerge } from '#rx'
import { set_hiddenvalues } from '#termsetting'
import { dtTerms } from '#shared/common.js'
import { getWrappedTvslst } from '#filter/filter'

export class GvBase extends TwBase {
	// type, isAtomic, $id are set in ancestor base classes
	term: GvTerm

	constructor(tw: GvTW, opts: TwOpts) {
		super(tw, opts)
		this.term = tw.term
	}

	/** tw.term must already be filled-in at this point */
	static async fill(tw: RawGvTW, opts: TwOpts = {}): Promise<GvTW> {
		if (!tw.term) throw `missing tw.term, must already be filled in`
		if (tw.term.type != 'geneVariant') throw `incorrect term.type='${tw.term?.type}', expecting 'geneVariant'`

		if (opts.defaultQ != null) {
			opts.defaultQ.isAtomic = true
			// merge defaultQ into tw.q
			copyMerge(tw.q, opts.defaultQ)
		}

		if (!tw.term.kind) {
			// support saved states that don't have term.kind, applied when rehydrating at runtime
			const term: any = tw.term
			if (term.gene || (term.name && !term.chr)) term.kind = 'gene'
			else if (term.chr) term.kind = 'coord'
			else throw 'unable to assign geneVariant term.kind'
		}

		if (tw.term.kind == 'gene') {
			if (!tw.term.gene) tw.term.gene = tw.term.name
			if (!tw.term.name) tw.term.name = tw.term.gene
			if (!tw.term.gene || !tw.term.name) throw 'missing gene/name'
		} else if (tw.term.kind == 'coord') {
			if (!tw.term.chr || !Number.isInteger(tw.term.start) || !Number.isInteger(tw.term.stop))
				throw 'no position specified'
			if (!tw.term.name) {
				tw.term.name = `${tw.term.chr}:${tw.term.start + 1}-${tw.term.stop}`
			}
		} else {
			throw 'cannot recognize tw.term.kind'
		}

		if (!tw.term.id) tw.term.id = tw.term.name

		if (!Object.keys(tw.q).includes('type')) tw.q.type = 'values'

		// fill term.groupsetting
		if (!tw.term.groupsetting) tw.term.groupsetting = { disabled: false }

		// get child dt terms
		await mayGetChildTerms(tw, opts.vocabApi)

		{
			// apply optional ds-level configs for this specific term
			const c = opts.vocabApi.termdbConfig.queries.cnv
			if (c && tw.term.name) {
				//if (c) valid js code but `&& tw.term.name` required to avoid type error
				// order of overide: 1) do not override existing settings in tw.q{} 2) c.cnvCutoffsByGene[thisGene] 3) default cutoffs in c
				const { cnvMaxLength, cnvGainCutoff, cnvLossCutoff } = c
				const defaultCnvCutoff =
					cnvMaxLength || cnvGainCutoff || cnvLossCutoff ? { cnvMaxLength, cnvGainCutoff, cnvLossCutoff } : {}
				Object.assign(tw.q, defaultCnvCutoff, c.cnvCutoffsByGene?.[tw.term.name] || {}, tw.q)
			}
		}

		/* 
			Pre-fill the tw.type, since it's required for ROUTING to the
			correct fill() function. Tsc will be able to use tw.type as a 
			discriminant property for the RawGvTW union type, enabling 
			static type checks on the input raw tw.

			NOTE: tw.type is NOT required when calling a specialized fill() 
			function directly, outside of TwRouter.fill(). The input tw.type
			does not have to be discriminated in that case.
		*/
		tw.type =
			!tw.q.type || tw.q.type == 'values' ? 'GvValuesTW' : tw.q.type == 'custom-groupset' ? 'GvCustomGsTW' : tw.type

		/*
			For each of fill() functions below:
			1. The `tw` argument must already have a tw.type string value, 
			   which corresponds to the RawGvTW* equivalent of the full GvTW* type 

			2. The fill() function must fill-in any expected missing values,
			   validate the tw.q shape at runtime, and throw on any error or mismatched expectation.
			   Runtime validation is required because the input raw tw can come from anywhere,
			   like term.bins.default, which is a runtime variable that is not possible to statically check.

			3. The filled-in tw, when returned, must be **coerced** to the full GvTW* type, 
			   in order to match the function signature's return type.
		*/
		switch (tw.type) {
			case 'GvValuesTW':
				return await GvValues.fill(tw)

			case 'GvCustomGsTW':
				return await GvCustomGS.fill(tw)

			default:
				throw `tw.type='${tw.type}' is not supported by GvBase.fill()`
		}
	}
}

// function to get child dt terms
// will use these terms to generate a frontend vocab
export async function mayGetChildTerms(tw: RawGvTW, vocabApi: VocabApi) {
	if (tw.term.childTerms) return
	if (!vocabApi.termdbConfig?.queries) throw 'termdbConfig.queries is missing'
	const termdbmclass = vocabApi.termdbConfig.mclass // custom mclass labels from dataset
	const dtTermsInDs: DtTerm[] = [] // dt terms in dataset
	const categories = await vocabApi.getCategories(tw.term)
	for (const _t of dtTerms) {
		const t = structuredClone(_t)
		if (!Object.keys(vocabApi.termdbConfig.queries).includes(t.query)) continue // dt is not in dataset
		const data = categories.lst.find(x => x.dt == t.dt)
		if (!data) continue // gene does not have this dt
		const byOrigin = vocabApi.termdbConfig.assayAvailability?.byDt[t.dt]?.byOrigin
		let classes
		if (byOrigin) {
			// dt has origins in dataset
			if (!t.origin) continue // dt term does not have origin, so skip
			if (!Object.keys(byOrigin).includes(t.origin)) throw 'unexpected origin of dt term'
			classes = data.classes.byOrigin[t.origin]
		} else {
			// dt does not have origins in dataset
			if (t.origin) continue // dt term has origin, so skip
			classes = data.classes
		}
		// filter for only those mutation classes that are in the dataset
		const values = Object.fromEntries(Object.entries(t.values).filter(([k, _v]) => Object.keys(classes).includes(k)))
		// add custom mclass labels from dataset
		for (const k of Object.keys(values)) {
			const v: any = values[k]
			if (termdbmclass && Object.keys(termdbmclass).includes(k)) v.label = termdbmclass[k].label
		}
		t.values = values
		t.parentTerm = structuredClone(tw.term)
		dtTermsInDs.push(t)
	}
	tw.term.childTerms = dtTermsInDs
}

export class GvValues extends GvBase {
	// term, type, isAtomic, $id are set in ancestor base classes
	q: GvValuesQ
	#tw: GvValuesTW
	#opts: TwOpts

	// declare a constructor, to narrow the tw type
	constructor(tw: GvValuesTW, opts: TwOpts = {}) {
		super(tw, opts)
		//this.term = tw.term // already set in base class
		this.q = tw.q
		this.#tw = tw
		this.#opts = opts
	}

	getTw() {
		return this.#tw
	}

	// See the relevant comments in the GvBase.fill() function above
	static async fill(tw: RawGvValuesTW): Promise<GvValuesTW> {
		if (!tw.type) tw.type = 'GvValuesTW'
		else if (tw.type != 'GvValuesTW') throw `expecting tw.type='GvValuesTW', got '${tw.type}'`
		if (tw.term.type != 'geneVariant') throw `expecting tw.term.type='geneVariant', got '${tw.term.type}'`
		const { term, q } = tw
		if (!q.type) q.type = 'values'
		else if (q.type != 'values') throw `expecting tw.q.type='values', got ${tw.q.type}`
		set_hiddenvalues(q, term)
		return tw as GvValuesTW
	}
}

export class GvCustomGS extends GvBase {
	// term, type, isAtomic, $id are set in ancestor base classes
	q: GvCustomGsQ
	groupset!: BaseGroupSet
	#tw: GvCustomGsTW
	#opts: TwOpts

	// declare a constructor, to narrow the tw type
	constructor(tw: GvCustomGsTW, opts: TwOpts = {}) {
		super(tw, opts)
		// this.term = tw.term // already set in base class
		this.q = tw.q
		Object.defineProperty(this, 'groupset', { value: this.q.customset })
		this.#tw = tw
		this.#opts = opts
	}

	getTw() {
		return this.#tw
	}

	// See the relevant comments in the GvBase.fill() function above
	static async fill(tw: RawGvCustomGsTW): Promise<GvCustomGsTW> {
		if (!tw.type) tw.type = 'GvCustomGsTW'
		else if (tw.type != 'GvCustomGsTW') throw `expecting tw.type='GvCustomGsTW', got '${tw.type}'`

		if (tw.term.type != 'geneVariant') throw `expecting tw.term.type='geneVariant', got '${tw.term.type}'`
		if (tw.q.type != 'custom-groupset') throw `expecting tw.q.type='custom-groupset', got '${tw.q.type}'`

		// may fill groups
		mayMakeGroups(tw)

		const { term, q } = tw
		if (!q.customset) throw 'missing tw.q.customset'
		if (!q.customset.groups.length) throw 'customset.groups[] is empty'
		set_hiddenvalues(q, term)
		return tw as GvCustomGsTW
	}
}

function mayMakeGroups(tw: RawGvCustomGsTW) {
	if (tw.q.type != 'custom-groupset' || tw.q.customset?.groups.length) return
	// custom groupset, but customset.groups[] is empty
	// fill with mutated group vs. wildtype group
	// for the first applicable dt in dataset
	const dtTerms = tw.term.childTerms
	if (!dtTerms) throw 'dtTerms is missing'
	let grp1Class, grp1Name, grp1Value, grp1Tvs, grp1Filter
	let grp2Class, grp2Name, grp2Value, grp2Tvs, grp2Filter
	for (const dtTerm of dtTerms) {
		const classes = Object.keys(dtTerm.values)
		if (classes.length < 2) {
			// fewer than 2 classes, try next dt term
			continue
		}
		// group 1 will be wildtype or first available mutant class
		grp1Class = classes.includes('WT') ? 'WT' : classes[0]
		grp1Name = dtTerm.values[grp1Class].label
		grp1Value = { key: grp1Class, label: grp1Name, value: grp1Class }
		grp1Tvs = { type: 'tvs', tvs: { term: dtTerm, values: [grp1Value] } }
		grp1Filter = getWrappedTvslst([grp1Tvs])
		if (dtTerm.origin) grp1Name += ` (${dtTerm.origin})`
		// group 2 will be all other classes
		if (classes.length == 2) {
			grp2Class = classes.find(c => c != grp1Class)
			if (!grp2Class) throw 'mutant class cannot be found'
			grp2Name = dtTerm.values[grp2Class].label
			grp2Value = { key: grp2Class, label: grp2Name, value: grp2Class }
			grp2Tvs = { type: 'tvs', tvs: { term: dtTerm, values: [grp2Value] } }
			if (dtTerm.origin) grp2Name += ` (${dtTerm.origin})`
		} else {
			grp2Tvs = { type: 'tvs', tvs: { term: dtTerm, values: [grp1Value], isnot: true } }
			grp2Name = classes.includes('WT') ? dtTerm.name : `Other ${dtTerm.name}`
		}
		grp2Filter = getWrappedTvslst([grp2Tvs])
		break
	}
	// assign filters to groups
	const grp1: FilterGroup = {
		name: grp1Name,
		type: 'filter',
		uncomputable: false,
		filter: grp1Filter
	}
	const grp2: FilterGroup = {
		name: grp2Name,
		type: 'filter',
		uncomputable: false,
		filter: grp2Filter
	}
	const grp0: FilterGroup = {
		name: 'Excluded categories',
		type: 'filter',
		uncomputable: true,
		filter: getWrappedTvslst() as Filter
	}
	// assign groups to custom groupset
	tw.q.customset = { groups: [grp0, grp1, grp2] }
}
