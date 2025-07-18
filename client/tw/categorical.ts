import type {
	CategoricalTerm,
	ValuesQ,
	PredefinedGroupSettingQ,
	CustomGroupSettingQ,
	BaseGroupSet,
	CatTWTypes,
	CatTWValues,
	CatTWPredefinedGS,
	CatTWCustomGS,
	RawCatTW,
	RawCatTWValues,
	RawCatTWPredefinedGS,
	RawCatTWCustomGS
} from '#types'
import type { TwOpts } from './TwBase.ts'
import { TwBase } from './TwBase.ts'
import { copyMerge } from '#rx'
import { set_hiddenvalues } from '#termsetting'

export type CatInstance = CatValues | CatPredefinedGS | CatCustomGS
export type CatTypes = typeof CatValues | typeof CatPredefinedGS | typeof CatCustomGS

export class CategoricalBase extends TwBase {
	// type, isAtomic, $id are set in ancestor base classes
	term: CategoricalTerm

	constructor(tw: CatTWTypes, opts: TwOpts) {
		super(tw, opts)
		this.term = tw.term
	}

	/** tw.term must already be filled-in at this point */
	static fill(tw: RawCatTW, opts: TwOpts = {}): CatTWTypes {
		if (!tw.term) throw `missing tw.term, must already be filled in`
		if (tw.term.type != 'categorical') throw `incorrect term.type='${tw.term?.type}', expecting 'categorical'`
		// GDC or other dataset may allow missing or empty term.values
		//if (!tw.term.values || !Object.keys(tw.term.values).length) throw `missing or empty tw.term.values`

		if (opts.defaultQ != null) {
			opts.defaultQ.isAtomic = true
			// merge defaultQ into tw.q
			copyMerge(tw.q, opts.defaultQ)
		}
		// set a default q.mode for clarity, otherwise `mode?: 'binary'` may seem like the only option
		// NOTE: many code that process categorical tw already assume discrete mode, without checking q.mode,
		// except for applications that allow or require q.mode='binary'
		if (!tw.q.mode) tw.q.mode = 'discrete'
		if (!tw.q) tw.q = { type: 'values', isAtomic: true }

		/* 
			Pre-fill the tw.type, since it's required for ROUTING to the
			correct fill() function. Tsc will be able to use tw.type as a 
			discriminant property for the RawCatTW union type, enabling 
			static type checks on the input raw tw.

			NOTE: tw.type is NOT required when calling a specialized fill() 
			function directly, outside of TwRouter.fill(). The input tw.type
			does not have to be discriminated in that case.
		*/
		tw.type =
			!tw.q.type || tw.q.type == 'values'
				? 'CatTWValues'
				: tw.q.type == 'predefined-groupset'
				? 'CatTWPredefinedGS'
				: tw.q.type == 'custom-groupset'
				? 'CatTWCustomGS'
				: tw.type

		/*
			For each of fill() functions below:
			1. The `tw` argument must already have a tw.type string value, 
			   which corresponds to the RawCatTW* equivalent of the full CatTW* type 

			2. The fill() function must fill-in any expected missing values,
			   validate the tw.q shape at runtime, and throw on any error or mismatched expectation.
			   Runtime validation is required because the input raw tw can come from anywhere,
			   like term.bins.default, which is a runtime variable that is not possible to statically check.

			3. The filled-in tw, when returned, must be **coerced** to the full CatTW* type, 
			   in order to match the function signature's return type.
		*/
		switch (tw.type) {
			case 'CatTWValues':
				return CatValues.fill(tw)

			case 'CatTWPredefinedGS':
				return CatPredefinedGS.fill(tw)

			case 'CatTWCustomGS':
				return CatCustomGS.fill(tw)

			default:
				throw `tw.type='${tw.type} (q.mode:q.type=${tw.q.mode}:${tw.q.type}' is not supported by CategoricalBase.fill()`
		}
	}
}

export class CatValues extends CategoricalBase {
	// term, type, isAtomic, $id are set in ancestor base classes
	q: ValuesQ
	#tw: CatTWValues
	#opts: TwOpts

	// declare a constructor, to narrow the tw type
	constructor(tw: CatTWValues, opts: TwOpts = {}) {
		super(tw, opts)
		//this.term = tw.term // already set in base class
		this.q = tw.q
		this.#tw = tw
		this.#opts = opts
	}

	getTw() {
		return this.#tw
	}

	// See the relevant comments in the CategoricalBase.fill() function above
	static fill(tw: RawCatTWValues): CatTWValues {
		if (!tw.type) tw.type = 'CatTWValues'
		else if (tw.type != 'CatTWValues') throw `expecting tw.type='CatTWValues', got '${tw.type}'`

		if (tw.term.type != 'categorical') throw `expecting tw.term.type='categorical', got '${tw.term.type}'`
		const { term, q } = tw
		if (!q.type) q.type = 'values'
		else if (q.type != 'values') throw `expecting tw.q.type='values', got ${tw.q.type}`

		// GDC or other dataset may allow missing term.values
		if (!term.values) term.values = {}
		//const numVals = Object.keys(tw.term.values).length
		//GDC or other dataset may allow empty term.values
		//if (!numVals) throw `empty term.values`
		if (q.mode == 'binary') {
			// a tw with q.type = 'values' can only have mode='binary' if it has exactly 2 values
			if (Object.keys(tw.term.values).length != 2) throw 'term.values must have exactly two keys'
		}
		set_hiddenvalues(q, term)
		return tw as CatTWValues
	}
}

export class CatPredefinedGS extends CategoricalBase {
	// term, type, isAtomic, $id are set in ancestor base classes
	q: PredefinedGroupSettingQ
	// set by Object.defineProperty() so that the property is not
	// enumerable, will not show up in JSON.stringify() and structuredClone(),
	// but can still be accessed by addon methods, unlike #private props
	groupset!: BaseGroupSet
	#tw: CatTWPredefinedGS
	#opts: TwOpts

	// declare a constructor, to narrow the tw type
	constructor(tw: CatTWPredefinedGS, opts: TwOpts = {}) {
		super(tw, opts)
		// this.term = tw.term // already set in base class
		this.q = tw.q
		this.#tw = tw
		Object.defineProperty(this, 'groupset', {
			value: this.#tw.term.groupsetting[this.#tw.q.predefined_groupset_idx]
		})
		this.#opts = opts
	}

	getTw() {
		return this.#tw
	}

	static fill(tw: RawCatTWPredefinedGS): CatTWPredefinedGS {
		if (!tw.type) tw.type = 'CatTWPredefinedGS'
		else if (tw.type != 'CatTWPredefinedGS') throw `expecting tw.type='CatTWPredefinedGS', got '${tw.type}'`

		if (tw.term.type != 'categorical') throw `expecting tw.term.type='categorical', got '${tw.term.type}'`
		if (tw.q.type != 'predefined-groupset') throw `expecting tw.q.type='predefined-groupset', got '${tw.q.type}'`

		const { term, q } = tw
		const i = q.predefined_groupset_idx
		if (i !== undefined && !Number.isInteger(i)) throw `missing or invalid tw.q.predefined_groupset_idx='${i}'`
		q.predefined_groupset_idx = i || 0
		const gs = tw.term.groupsetting
		if (!gs) throw 'no term.groupsetting'
		if (!gs.lst?.length) throw 'term.groupsetting.lst is empty'
		const groupset = gs.lst?.[q.predefined_groupset_idx]
		if (!groupset) throw `no groupset entry for groupsetting.lst?.[predefined_groupset_idx=${i}]`

		if (q.mode == 'binary') {
			//
			if (groupset.groups.length != 2) throw 'there must be exactly two groups'
		}
		set_hiddenvalues(q, term)
		return tw as CatTWPredefinedGS
	}
}

export class CatCustomGS extends CategoricalBase {
	// term, type, isAtomic, $id are set in ancestor base classes
	q: CustomGroupSettingQ
	groupset!: BaseGroupSet
	#tw: CatTWCustomGS
	#opts: TwOpts

	// declare a constructor, to narrow the tw type
	constructor(tw: CatTWCustomGS, opts: TwOpts = {}) {
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

	// See the relevant comments in the CategoricalBase.fill() function above
	static fill(tw: RawCatTWCustomGS): CatTWCustomGS {
		if (!tw.type) tw.type = 'CatTWCustomGS'
		else if (tw.type != 'CatTWCustomGS') throw `expecting tw.type='CatTWCustomGS', got '${tw.type}'`

		if (tw.term.type != 'categorical') throw `expecting tw.term.type='categorical', got '${tw.term.type}'`
		if (tw.q.type != 'custom-groupset') throw `expecting tw.q.type='custom-groupset', got '${tw.q.type}'`

		const { term, q } = tw
		if (!q.customset) throw `missing tw.q.customset`
		if (q.mode == 'binary') {
			if (q.customset.groups.length != 2) throw 'there must be exactly two groups'
			// TODO:
			// - add validation that both groups have samplecount > 0 or some other minimum count
			// - rough example
			// const data = vocabApi.getCategories() or maybe this.countSamples()
			// if (data.sampleCounts) {
			// 	for (const grp of groupset.groups) {
			// 		if (!data.sampleCounts.find(d => d.label === grp.name))
			// 			throw `there are no samples for the required binary value=${grp.name}`
			// 	}
			// }
		}
		set_hiddenvalues(q, term)
		return tw as CatTWCustomGS
	}
}
