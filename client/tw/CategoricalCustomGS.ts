import { CatTWCustomGS, HandlerOpts, CustomGroupSettingQ, RawCustomGroupsetQ, CategoricalTerm } from '#types'
import { CategoricalBase } from './CategoricalTW.ts'
import { Handler } from './Handler'

export class CategoricalCustomGS extends Handler {
	tw: CatTWCustomGS
	base: CategoricalBase

	constructor(fullTw: CatTWCustomGS, opts: HandlerOpts = {}) {
		super(fullTw, opts) // sets this.opts, this.root
		this.tw = fullTw
		this.base = opts.base
	}

	static fillQ(term: CategoricalTerm, q: RawCustomGroupsetQ): CustomGroupSettingQ {
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

		return q
	}
}
