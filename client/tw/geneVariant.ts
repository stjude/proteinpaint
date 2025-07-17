import type {
	GvTerm,
	BaseGroupSet,
	GvValuesQ,
	GvCustomGsQ,
	GvPredefinedGsQ,
	RawGvValuesTW,
	GvValuesTW,
	RawGvCustomGsTW,
	GvCustomGsTW,
	RawGvPredefinedGsTW,
	GvPredefinedGsTW,
	RawGvTW,
	GvTW
} from '#types'
import { TwBase, type TwOpts } from './TwBase.ts'
import { copyMerge } from '#rx'
import { set_hiddenvalues } from '#termsetting'
import { mayMakeGroups, getPredefinedGroupsets } from '../termsetting/handlers/geneVariant'

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
			!tw.q.type || tw.q.type == 'values'
				? 'GvValuesTW'
				: tw.q.type == 'predefined-groupset'
				? 'GvPredefinedGsTW'
				: tw.q.type == 'custom-groupset'
				? 'GvCustomGsTW'
				: tw.type

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

			case 'GvPredefinedGsTW':
				return await GvPredefinedGS.fill(tw, opts)

			case 'GvCustomGsTW':
				return await GvCustomGS.fill(tw, opts)

			default:
				throw `tw.type='${tw.type}' is not supported by GvBase.fill()`
		}
	}
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

export class GvPredefinedGS extends GvBase {
	// term, type, isAtomic, $id are set in ancestor base classes
	q: GvPredefinedGsQ
	groupset!: BaseGroupSet
	#tw: GvPredefinedGsTW
	#opts: TwOpts

	// declare a constructor, to narrow the tw type
	constructor(tw: GvPredefinedGsTW, opts: TwOpts = {}) {
		super(tw, opts)
		// this.term = tw.term // already set in base class
		this.q = tw.q
		Object.defineProperty(this, 'groupset', { value: this.term.groupsetting[this.#tw.q.predefined_groupset_idx] })
		this.#tw = tw
		this.#opts = opts
	}

	getTw() {
		return this.#tw
	}

	// See the relevant comments in the GvBase.fill() function above
	static async fill(tw: RawGvPredefinedGsTW, opts: TwOpts = {}): Promise<GvPredefinedGsTW> {
		if (!tw.type) tw.type = 'GvPredefinedGsTW'
		else if (tw.type != 'GvPredefinedGsTW') throw `expecting tw.type='GvPredefinedGsTW', got '${tw.type}'`

		if (tw.term.type != 'geneVariant') throw `expecting tw.term.type='geneVariant', got '${tw.term.type}'`
		if (tw.q.type != 'predefined-groupset') throw `expecting tw.q.type='predefined-groupset', got '${tw.q.type}'`
		if (!tw.q.predefined_groupset_idx) tw.q.predefined_groupset_idx = 0

		// get predefined groupsets
		await getPredefinedGroupsets(tw, opts.vocabApi)

		const { term, q } = tw
		if (!term.groupsetting?.lst.length) throw 'term.groupsetting.lst[] is empty'
		set_hiddenvalues(q, term)
		return tw as GvPredefinedGsTW
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
	static async fill(tw: RawGvCustomGsTW, opts: TwOpts = {}): Promise<GvCustomGsTW> {
		if (!tw.type) tw.type = 'GvCustomGsTW'
		else if (tw.type != 'GvCustomGsTW') throw `expecting tw.type='GvCustomGsTW', got '${tw.type}'`

		if (tw.term.type != 'geneVariant') throw `expecting tw.term.type='geneVariant', got '${tw.term.type}'`
		if (tw.q.type != 'custom-groupset') throw `expecting tw.q.type='custom-groupset', got '${tw.q.type}'`

		// may fill groups
		await mayMakeGroups(tw, opts.vocabApi)

		const { term, q } = tw
		if (!q.customset) throw 'missing tw.q.customset'
		if (!q.customset.groups.length) throw 'customset.groups[] is empty'
		set_hiddenvalues(q, term)
		return tw as GvCustomGsTW
	}
}
