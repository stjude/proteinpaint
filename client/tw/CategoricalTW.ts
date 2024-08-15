import { RawCatTW, CategoricalTW } from '#types'
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
		if (tw.term.type != 'categorical') throw `incorrect term.type='${tw.term?.type}', expecting 'categorical'`
		if (!tw.id && !tw.term.id) throw 'missing tw.id and tw.term.id'
		//if (!tw.q.type) tw.q = {...tw.q, ...defaultQ}
		return {
			id: tw.id || tw.term?.id || 'aaa',
			term: {
				type: 'categorical',
				id: tw.term?.id || 'test',
				name: tw.term?.name || tw.term?.id || 'test',
				values: tw.term?.values || {},
				groupsetting: {
					...{ useIndex: 0, lst: [] },
					...(tw.term?.groupsetting || {})
				}
			},
			q: !tw.q ? { type: 'values' } : tw.q
		}
	}
}
