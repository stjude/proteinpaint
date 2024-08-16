import { RawCatTW, CategoricalTW, CategoricalQ, PredefinedGroupSettingQ } from '#types'
import { RootTW, TwInitOpts } from './RootTW.ts'

export class CategoricalBase extends RootTW {
	tw: CategoricalTW
	vocabApi?: any

	constructor(tw: CategoricalTW, vocabApi?: any) {
		super()
		this.tw = tw
		if (vocabApi) this.vocabApi = vocabApi
	}

	static async init(rawTW: RawCatTW, vocabApi?: any): Promise<CategoricalBase> {
		const tw = await CategoricalBase.fill(rawTW, vocabApi)
		return new CategoricalBase(tw, vocabApi)
	}

	/** tw.term must already be filled-in at this point */
	static async fill(tw: RawCatTW, vocabApi?: any): Promise<CategoricalTW> {
		if (!tw.term) throw `missing tw.term, must already be filled in`
		if (tw.term.type != 'categorical') throw `incorrect term.type='${tw.term?.type}', expecting 'categorical'`
		if (!tw.id && !tw.term.id) throw 'missing tw.id and tw.term.id'
		return {
			id: tw.id || tw.term?.id || 'aaa',
			term: {
				type: 'categorical',
				id: tw.term?.id || 'test',
				name: tw.term?.name || tw.term?.id || 'test',
				values: tw.term?.values || {},
				groupsetting: tw.term.groupsetting || { disabled: true }
			},
			q: getQ(tw)
		} //satisfies CategoricalTW
	}
}

function getQ(tw: RawCatTW): CategoricalQ {
	if (!tw.q) return { type: 'values', isAtomic: true }
	if (tw.q!.type == 'predefined-groupset') {
		const i = tw.q.predefined_groupset_idx
		if (i !== undefined && !Number.isInteger(i)) throw `missing or invalid tw.q.predefined_groupset_idx='${i}'`
		return { ...tw.q, predefined_groupset_idx: i || 0 }
	}
	if (tw.q.type == 'custom-groupset') {
		return tw.q
	}
	if (!tw.q.type) {
		return { ...tw.q, type: 'values' }
	}
	throw `invalid tw.q`
}
