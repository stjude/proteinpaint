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
	RawTW,
	RawValuesQ,
	RawPredefinedGroupsetQ,
	RawCustomGroupsetQ,
	RawCatTWValues,
	RawCatTWPredefinedGS,
	RawCatTWCustomGS
} from '#types'
import { CategoricalValues } from './CategoricalValues'
import { CategoricalPredefinedGS } from './CategoricalPredefinedGS'
import { CategoricalCustomGS } from './CategoricalCustomGS'
import { copyMerge } from '#rx'

export type CategoricalInstance = CategoricalValues | CategoricalPredefinedGS | CategoricalCustomGS

export class CategoricalBase {
	static init(rawTW: RawCatTW, opts: HandlerOpts = {}): CategoricalInstance {
		const tw: CategoricalTW = CategoricalBase.fill(rawTW, opts)
		if (tw.q.type == 'values') {
			// has to use type casting/hint for tw argument, since a type union discriminant property cannot be from a nested object,
			// and creating a new discriminant property on the root tw object seems too much to fix the
			// simple typecheck errors that are only emitted from this function (if type casting is not used)
			return new CategoricalValues(tw as CatTWValues, { ...opts, base: CategoricalBase })
		} else if (tw.q.type == 'predefined-groupset') {
			return new CategoricalPredefinedGS(tw as CatTWPredefinedGS, { ...opts, base: CategoricalBase })
		} else if (tw.q.type == 'custom-groupset') {
			return new CategoricalCustomGS(tw as CatTWCustomGS, { ...opts, base: CategoricalBase })
		} else {
			throw `unknown categorical class`
		}
	}

	/** tw.term must already be filled-in at this point */
	static fill(tw: RawCatTW, vocabApi?: any): CategoricalTW {
		if (!tw.term) throw `missing tw.term, must already be filled in`
		if (tw.term.type != 'categorical') throw `incorrect term.type='${tw.term?.type}', expecting 'categorical'`
		if (!tw.term.values || !Object.keys(tw.term.values).length) throw `missing or empty tw.term.values`
		return { ...tw, term: tw.term, q: getQ(tw) }
	}
}

function getQ(tw: RawCatTW, defaultQ = null): CategoricalQ {
	if (defaultQ != null) {
		;(defaultQ as any).isAtomic = true
		// merge defaultQ into tw.q
		copyMerge(tw.q, defaultQ)
	}

	if (!tw.q) tw.q = { type: 'values', isAtomic: true }

	// has to use type casting/hint for tw argument, since a type union discriminant property cannot be from a nested object,
	// and creating a new discriminant property on the root tw object seems too much to fix the
	// simple typecheck errors that are only emitted from this function (if type casting is not used)
	if (tw.q.type == 'predefined-groupset') {
		return CategoricalPredefinedGS.fillQ(tw as RawCatTWPredefinedGS)
	} else if (tw.q.type == 'custom-groupset') {
		return CategoricalCustomGS.fillQ(tw as RawCatTWCustomGS)
	} else if (!tw.q.type || tw.q.type == 'values') {
		return CategoricalValues.fillQ(tw as RawCatTWValues)
	}
	throw `invalid tw.q`
}
