import {
	CatTWPredefinedGS,
	HandlerOpts,
	RawCatTW,
	CategoricalTW,
	PredefinedGroupSettingQ,
	RawCatTWPredefinedGS
} from '#types'
import { CategoricalBase } from './CategoricalTW.ts'
import { TwRouter } from './TwRouter.ts'

export class CategoricalPredefinedGS {
	tw: CatTWPredefinedGS
	opts: Partial<HandlerOpts>
	base: CategoricalBase
	root: TwRouter

	constructor(fullTw: CatTWPredefinedGS, opts: HandlerOpts = {}) {
		this.tw = fullTw
		this.opts = opts
		this.base = opts.base
		this.root = opts.root
	}

	static fillQ(tw: RawCatTWPredefinedGS): PredefinedGroupSettingQ {
		const i = tw.q.predefined_groupset_idx
		if (i !== undefined && !Number.isInteger(i)) throw `missing or invalid tw.q.predefined_groupset_idx='${i}'`
		const q: PredefinedGroupSettingQ = { ...tw.q, predefined_groupset_idx: i || 0 }
		tw.q = q

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
		return q
	}
}
