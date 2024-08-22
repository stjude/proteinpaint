import {
	CatTWPredefinedGS,
	HandlerOpts,
	CategoricalTerm,
	RawCatTW,
	CategoricalTW,
	PredefinedGroupSettingQ,
	RawPredefinedGroupsetQ
} from '#types'
import { CategoricalBase } from './CategoricalTW.ts'
import { Handler } from './Handler'

export class CategoricalPredefinedGS extends Handler {
	tw: CatTWPredefinedGS
	base: CategoricalBase

	constructor(fullTw: CatTWPredefinedGS, opts: HandlerOpts = {}) {
		super(fullTw, opts) // sets this.opts, this.root
		this.tw = fullTw
		this.base = opts.base
	}

	static fillQ(term: CategoricalTerm, _q: RawPredefinedGroupsetQ): PredefinedGroupSettingQ {
		const i = _q.predefined_groupset_idx
		if (i !== undefined && !Number.isInteger(i)) throw `missing or invalid tw.q.predefined_groupset_idx='${i}'`
		const q: PredefinedGroupSettingQ = { ..._q, predefined_groupset_idx: i || 0 }
		const gs = term.groupsetting
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
		return q
	}
}
