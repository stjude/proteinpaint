import {
	CategoricalTerm,
	CategoricalQ,
	ValuesQ,
	PredefinedGroupSettingQ,
	CustomGroupSettingQ,
	BaseGroupSet,
	CatTWValues,
	CatTWPredefinedGS,
	CatTWCustomGS,
	RawCatTW
} from '#types'
import { TwBase, TwOpts } from './TwBase'

export type CatInstance = CatValues | CatPredefinedGS | CatCustomGS
export type CatTypes = typeof CatValues | typeof CatPredefinedGS | typeof CatCustomGS

export class CatValues extends TwBase {
	term: CategoricalTerm
	q: ValuesQ
	#tw: CatTWValues
	#opts: TwOpts

	// declare a constructor, to narrow the tw type
	constructor(tw: CatTWValues, opts: TwOpts = {}) {
		super(tw, opts)
		this.term = tw.term
		this.q = tw.q
		this.#tw = tw
		this.#opts = opts
	}

	//
	// This function asks the following, to confirm that RawCatTW can be converted to CatTWValues type
	// 1. Can the function process the tw? If false, the tw will be passed by the router to a different specialized filler
	// 2. If true, is the tw valid for processing, is it full or fillable? If not, must throw to stop subsequent processing
	//    of the tw by any other code
	//
	static accepts(tw: RawCatTW): tw is CatTWValues {
		const { term, q } = tw
		if (!q.type) q.type = 'values'
		if (term.type != 'categorical' || q.type != 'values') return false
		// GDC or other dataset may allow missing term.values
		if (!term.values) term.values = {} //throw 'no term.values defined'
		const numVals = Object.keys(tw.term.values).length
		// GDC or other dataset may allow empty term.values
		//if (!numVals) throw `empty term.values`
		if (q.mode == 'binary') {
			if (Object.keys(tw.term.values).length != 2) throw 'term.values must have exactly two keys'
			// TODO:
			// - add validation that both groups have samplecount > 0 or some other minimum count
			// - rough example
			// const data = vocabApi.getCategories() or maybe this.countSamples()
			// if (data.sampleCounts) {
			// 	for (const [k, v] of Object.keys(tw.term.values)) {
			// 		if (!data.sampleCounts.find(d => d.key === key)) {
			//			throw `there are no samples for the required binary value=${key}`
			//    }
			// 	}
			// }
		}
		tw.type = 'CatTWValues'
		return true
	}
}

export class CatPredefinedGS extends TwBase {
	term: CategoricalTerm
	q: PredefinedGroupSettingQ
	#groupset: BaseGroupSet
	#tw: CatTWPredefinedGS
	#opts: TwOpts

	// declare a constructor, to narrow the tw type
	constructor(tw: CatTWPredefinedGS, opts: TwOpts = {}) {
		super(tw, opts)
		this.term = tw.term // to narrow to categorical term, since TwBase.term is just Term
		this.q = tw.q
		this.#tw = tw
		this.#groupset = this.term.groupsetting[this.#tw.q.predefined_groupset_idx]
		this.#opts = opts
	}

	//
	// This function asks the following, to confirm that RawCatTW can be converted to a CatTWPredefinedGS type
	// 1. Can the function process the tw? If false, the tw will be passed by the router to a different specialized filler
	// 2. If true, is the tw valid for processing, is it full or fillable? If not, must throw to stop subsequent processing
	//    of the tw by any other code
	//
	static accepts(tw: RawCatTW, opts: TwOpts = {}): tw is CatTWPredefinedGS {
		const { term, q } = tw
		if (term.type != 'categorical' || q.type != 'predefined-groupset') return false
		const i = q.predefined_groupset_idx
		if (i !== undefined && !Number.isInteger(i)) throw `missing or invalid tw.q.predefined_groupset_idx='${i}'`
		q.predefined_groupset_idx = i || 0
		const gs = tw.term.groupsetting
		if (!gs) throw 'no term.groupsetting'
		if (!gs.lst?.length) throw 'term.groupsetting.lst is empty'
		const groupset = gs.lst?.[q.predefined_groupset_idx]
		if (!groupset) throw `no groupset entry for groupsetting.lst?.[predefined_groupset_idx=${i}]`

		if (q.mode == 'binary') {
			if (groupset.groups.length != 2) throw 'there must be exactly two groups'
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
		tw.type = 'CatTWPredefinedGS'
		return true
	}
}

export class CatCustomGS extends TwBase {
	term: CategoricalTerm
	q: CustomGroupSettingQ
	#groupset: BaseGroupSet
	#tw: CatTWCustomGS
	#opts: TwOpts

	// declare a constructor, to narrow the tw type
	constructor(tw: CatTWCustomGS, opts: TwOpts = {}) {
		super(tw, opts)
		this.term = tw.term // to narrow to categorical term, since TwBase.term is just Term
		this.q = tw.q
		this.#groupset = this.q.customset
		this.#tw = tw
		this.#opts = opts
	}

	//
	// This function asks the following, to confirm that RawCatTW can be converted to CatTWCustomGS type
	// 1. Can the function process the tw? If false, the tw will be passed by the router to a different specialized filler
	// 2. If true, is the tw valid for processing, is it full or fillable? If not, must throw to stop subsequent processing
	//    of the tw by any other code
	//
	static accepts(tw: RawCatTW): tw is CatTWCustomGS {
		const { term, q } = tw
		if (term.type != 'categorical' || q.type != 'custom-groupset') return false
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
		tw.type = 'CatTWCustomGS'
		return true
	}
}
