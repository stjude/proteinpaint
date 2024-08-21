import {
	RawCatTW,
	CategoricalTW,
	CategoricalQ,
	PredefinedGroupSettingQ,
	CatTWValues,
	CatTWPredefinedGS,
	CatTWCustomGS,
	HandlerOpts,
	ValuesQ,
	RawValuesQ,
	RawPredefinedGroupsetQ,
	RawCustomGroupsetQ
} from '#types'
import { CategoricalValues } from './CategoricalValues'
import { CategoricalPredefinedGS } from './CategoricalPredefinedGS'
import { CategoricalCustomGS } from './CategoricalCustomGS'
import { copyMerge } from '#rx'

export type CategoricalInstance = CategoricalValues | CategoricalPredefinedGS | CategoricalCustomGS

export class CategoricalBase {
	static init(tw: CategoricalTW, opts: HandlerOpts = {}): CategoricalInstance {
		opts.base = CategoricalBase

		switch (tw.q.type) {
			//
			// - has to use type casting/hint for tw argument, since a type union discriminant property cannot be
			//   from a nested object and creating a new discriminant property on the root tw object seems too much to
			//   fix the simple typecheck errors that are only emitted from this function (if type casting is not used)
			//
			// - (may rethink the following later) would also be hard to separate the `(tw,)` argument into `(term, q,)`,
			//   as done for getQ() below to not require type casting in that function, since the class itself benefits
			//   from having a typed-as-a-whole `tw` property
			//
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

	//
	static initRaw(rawTW: RawCatTW, opts: HandlerOpts = {}): CategoricalInstance {
		const tw: CategoricalTW = CategoricalBase.fill(rawTW, opts)
		return CategoricalBase.init(tw, opts)
	}

	/** tw.term must already be filled-in at this point */
	static fill(tw: RawCatTW, vocabApi?: any): CategoricalTW {
		if (!tw.term) throw `missing tw.term, must already be filled in`
		if (tw.term.type != 'categorical') throw `incorrect term.type='${tw.term?.type}', expecting 'categorical'`
		if (!tw.term.values || !Object.keys(tw.term.values).length) throw `missing or empty tw.term.values`
		return { ...tw, term: tw.term, q: CategoricalBase.getQ(tw) }
	}

	static getQ(tw: RawCatTW, defaultQ: any = null): CategoricalQ {
		if (defaultQ != null) {
			defaultQ.isAtomic = true
			// merge defaultQ into tw.q
			copyMerge(tw.q, defaultQ)
		}
		if (!tw.q) tw.q = { type: 'values', isAtomic: true }

		// Unlike the init() function above, the arguments to the fillQ() methods below
		// can be easily separated into `(term, q)`, so that the discriminant property
		// is not nested and is found directly in the root q object as second argument,
		// thereby avoiding the need for type casting.
		if (tw.q.type == 'predefined-groupset') {
			return CategoricalPredefinedGS.fillQ(tw.term, tw.q)
		} else if (tw.q.type == 'custom-groupset') {
			return CategoricalCustomGS.fillQ(tw.term, tw.q)
		} else if (!tw.q.type || tw.q.type == 'values') {
			return CategoricalValues.fillQ(tw.term, tw.q)
		}
		throw `invalid tw.q`
	}
}
