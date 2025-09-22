import type {
	CategoricalTerm,
	CategoricalQ,
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
import { set_hiddenvalues, type UseCase } from '#termsetting'
import { throwMsgWithFilePathAndFnName } from '#dom/sayerror'

export type CatInstance = CatValues | CatPredefinedGS | CatCustomGS
export type CatTypes = typeof CatValues | typeof CatPredefinedGS | typeof CatCustomGS

export class CategoricalBase extends TwBase {
	// type, isAtomic, $id are set in ancestor base classes
	term!: CategoricalTerm
	q: CategoricalQ

	constructor(tw: CatTWTypes, opts: TwOpts) {
		super(tw, opts)
		this.term = tw.term
		this.q = tw.q
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

	getTitleText() {
		return this.term.name
	}

	getStatus(_?: UseCase) {
		return { text: '' }
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

	getStatus(usecase?: UseCase) {
		if (usecase?.target == 'regression') {
			return this.q.mode == 'binary' ? { text: 'binary' } : { text: 'categorical' }
		}
		return { text: '' }
	}

	getGroups(category2samplecount: any[], maxGrpNum: number = 3) {
		const values: any[] = []
		const groups: any[] = []
		const grpIdxes: Set<number> = new Set([0, 1, 2])
		for (const v of category2samplecount) {
			if (v.uncomputable) return //Still necessary? Possibly taken care of termdb route... somewhere
			if (v?.group > maxGrpNum)
				throwMsgWithFilePathAndFnName(
					`The maximum number of groups is ${maxGrpNum}. The group index for value = ${v.label} is ${v.group}`
				)
			const value = {
				key: v.key,
				label: v.label,
				group: v.group || 1,
				samplecount: v.samplecount
			}
			values.push(value)
		}

		for (const g of Array.from(grpIdxes)) {
			//add any required groups, specifically Excluded Categories and Group 2
			groups.push({
				currentIdx: g,
				type: this.type,
				name: g === 0 ? `Excluded categories` : `Group ${g.toString()}`,
				uncomputable: g === 0
			})
		}

		return { groups, values }
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

	getStatus(usecase?: UseCase) {
		if (usecase?.target == 'regression') {
			return this.q.mode == 'binary' ? { text: 'binary' } : { text: 'categorical' }
		}
		// fill() should have already validated q
		return { text: this.term.groupsetting.lst?.[this.q.predefined_groupset_idx].name || 'predefined groups' }
	}

	getGroups() {
		throw `q.type='predefined-groupset' not supported in groupsetting menu`
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
			if (q.sampleCounts && tw.term.values) {
				for (const key in tw.term.values) {
					if (!q.sampleCounts.find(d => d.key === key))
						throw `there are no samples for the required binary value=${key}`
				}
			}
		}
		set_hiddenvalues(q, term)
		return tw as CatTWCustomGS
	}

	getStatus(usecase?: UseCase) {
		if (usecase?.target == 'regression') {
			return this.q.mode == 'binary' ? { text: 'binary' } : { text: 'categorical' }
		}
		// TODO: move this validation to the fill() function above?
		const n = this.q.customset.groups.filter(group => {
			if (group.type != 'values') throw `group.type must be 'values'`
			if (!group.uncomputable) return true
		}).length
		return { text: 'Divided into ' + n + ' groups' }
	}

	getGroups(category2samplecount) {
		const values: any = []
		const groups: any[] = []
		const grpIdxes = new Set([0, 1, 2])
		const q = this.q
		for (const [i, g] of q.customset.groups.entries()) {
			const group = g as any // TODO: improve typing
			groups.push({
				currentIdx: i,
				type: group.type,
				name: group.name,
				uncomputable: group.uncomputable
			})
			grpIdxes.delete(i)
			if (group.type != 'values') throw `group.type should equal 'values'`
			for (const value of group.values) {
				/** label may not be provided in groupsetting.customset.
				 * If missing, find the label from category2samplecout or
				 * use the last ditch effort to use the key.
				 */
				const c2s = category2samplecount?.find(
					(d: { key: string; label?: string; samplecount: number }) => d.key == value.key
				)
				const label = value.label || c2s?.label || value.key
				values.push({
					key: value.key,
					label: label,
					group: i,
					samplecount: value.samplecount || c2s.samplecount
				})
			}
		}
		return { groups, values }
	}
}
