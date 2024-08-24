import { RawCatTW, CategoricalTW, CatTWValues, CatTWPredefinedGS, CatTWCustomGS } from '#types'
import { HandlerOpts } from './Handler'
import { CategoricalValues } from './CategoricalValues'
import { CategoricalPredefinedGS } from './CategoricalPredefinedGS'
import { CategoricalCustomGS } from './CategoricalCustomGS'
import { copyMerge } from '#rx'

export type CatHandlerInstance = CategoricalValues | CategoricalPredefinedGS | CategoricalCustomGS
export type CategoricalTypes = typeof CategoricalValues | typeof CategoricalPredefinedGS | typeof CategoricalCustomGS

export class CategoricalRouter {
	static init(tw: CategoricalTW, opts: HandlerOpts = {}): CatHandlerInstance {
		opts.router = CategoricalRouter
		switch (tw.q.type) {
			// - has to use type casting/hint for tw argument, since a type union discriminant property cannot be
			//   from a nested object and creating a new discriminant property on the root tw object seems too much to
			//   fix the simple typecheck errors that are only emitted from this function (if type casting is not used)
			// - may use a better approach later, such as a type guard
			case 'values':
				return new CategoricalValues(tw as CatTWValues, opts)

			case 'predefined-groupset':
				return new CategoricalPredefinedGS(tw as CatTWPredefinedGS, opts)

			case 'custom-groupset':
				return new CategoricalCustomGS(tw as CatTWCustomGS, opts)

			default:
				throw `unknown categorical class`
		}
	}

	static getCls(tw: CategoricalTW): CategoricalTypes {
		switch (tw.q.type) {
			// - has to use type casting/hint for tw argument, since a type union discriminant property cannot be
			//   from a nested object and creating a new discriminant property on the root tw object seems too much to
			//   fix the simple typecheck errors that are only emitted from this function (if type casting is not used)
			// - may use a better approach later, such as a type guard
			case 'values':
				return CategoricalValues // new CategoricalValues(tw as CatTWValues, opts)

			case 'predefined-groupset':
				return CategoricalPredefinedGS //(tw as CatTWPredefinedGS, opts)

			case 'custom-groupset':
				return CategoricalCustomGS //(tw as CatTWCustomGS, opts)

			default:
				throw `unknown categorical class`
		}
	}

	//
	static initRaw(rawTW: RawCatTW, opts: HandlerOpts = {}): CatHandlerInstance {
		const tw: CategoricalTW = CategoricalRouter.fill(rawTW, opts)
		return CategoricalRouter.init(tw, opts)
	}

	/** tw.term must already be filled-in at this point */
	static fill(tw: RawCatTW, opts: HandlerOpts = {}): CategoricalTW {
		if (!tw.term) throw `missing tw.term, must already be filled in`
		if (tw.term.type != 'categorical') throw `incorrect term.type='${tw.term?.type}', expecting 'categorical'`
		if (!tw.term.values || !Object.keys(tw.term.values).length) throw `missing or empty tw.term.values`

		if (opts.defaultQ != null) {
			opts.defaultQ.isAtomic = true
			// merge defaultQ into tw.q
			copyMerge(tw.q, opts.defaultQ)
		}
		if (!tw.q) tw.q = { type: 'values', isAtomic: true }

		//
		// The `.accepts()` type guard function asks the following, to confirm that RawCatTW can be converted to a CategoricalTW type
		// 1. Can the function process the tw? If false, the tw will be passed by the router to a different specialized filler
		// 2. If true, is the tw valid for processing, is it full or fillable? If not, must throw to stop subsequent processing
		//    of the tw by any other code
		//
		// NOTES:
		// - The validate() naming convention is not appropriate here, since it's okay for accepts() to return false
		//   and not throw, whereas validate() is more like an assertion function.
		// - The isTypeName() naming convention is also not appropriate, since the function may also fill-in/mutate the
		//   tw, instead of just inspecting it as implied by isTypeName()
		//
		if (CategoricalValues.accepts(tw)) return tw
		else if (CategoricalPredefinedGS.accepts(tw)) return tw
		else if (CategoricalCustomGS.accepts(tw)) return tw
		else throw `cannot process the raw categorical tw`

		// !!! Previous approach, kept here for future reference: !!!
		//
		// Unlike the init() function above, the arguments to the fillQ() methods below
		// can be easily separated into `(term, q)`, so that the discriminant property
		// is not nested and is found directly in the root q object as second argument,
		// thereby avoiding the need for type casting.
		//
		// if (tw.q.type == 'predefined-groupset') {
		// 	return CategoricalPredefinedGS.fillQ(tw.term, tw.q)
		// } else if (tw.q.type == 'custom-groupset') {
		// 	return CategoricalCustomGS.fillQ(tw.term, tw.q)
		// } else if (!tw.q.type || tw.q.type == 'values') {
		// 	return CategoricalValues.fillQ(tw.term, tw.q)
		// }
		// throw `invalid tw.q`
	}
}
