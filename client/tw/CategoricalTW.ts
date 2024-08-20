import {
	RawCatTW,
	CategoricalTW,
	CategoricalQ,
	PredefinedGroupSettingQ,
	CatTWValues,
	CatTWPredefinedGS,
	CatTWCustomGS,
	HandlerOpts,
	ValuesQ
} from '#types'
import { CategoricalValues } from './CategoricalValues'
import { CategoricalPredefinedGS } from './CategoricalPredefinedGS'
import { CategoricalCustomGS } from './CategoricalCustomGS'

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
		if (!tw.id && !tw.term.id) throw 'missing tw.id and tw.term.id'
		const id = tw.id || tw.term?.id || 'aaa-TODO'
		if (!tw.term.values || !Object.keys(tw.term.values).length) throw `missing or empty tw.term.values for id='${id}'`
		return {
			...tw,
			id,
			term: tw.term,
			q: getQ(tw) as CategoricalQ
		}
		// const q: CategoricalQ = getQ(tw)
		// if (q.type == 'values') {
		// 	return {
		// 		id,
		// 		term: tw.term,
		// 		q
		// 	} satisfies CatTWValues
		// } else if (q.type == 'predefined-groupset') {
		// 	return {
		// 		id,
		// 		term: tw.term,
		// 		q
		// 	} satisfies CatTWPredefinedGS
		// } else if (q.type == 'custom-groupset') {
		// 	return {
		// 		id,
		// 		term: tw.term,
		// 		q
		// 	} satisfies CatTWCustomGS
		// } else throw `unable to fill categorical tw`
	}
}

function getQ(tw: RawCatTW): CategoricalQ {
	if (!tw.q) return { type: 'values', isAtomic: true }
	if (tw.q!.type == 'predefined-groupset') {
		const i = tw.q.predefined_groupset_idx
		if (i !== undefined && !Number.isInteger(i)) throw `missing or invalid tw.q.predefined_groupset_idx='${i}'`
		return { ...tw.q, predefined_groupset_idx: i || 0 }
	} else if (tw.q.type == 'custom-groupset') {
		return tw.q
	} else if (tw.q.type == 'values') {
		return tw.q as ValuesQ
	} else if (!tw.q.type) {
		return { ...tw.q, type: 'values' }
	}
	console.log(74, tw)
	throw `invalid tw.q`
}
