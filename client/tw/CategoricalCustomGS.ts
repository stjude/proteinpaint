import { CatTWCustomGS, HandlerOpts, CustomGroupSettingQ, RawCatTWCustomGS } from '#types'
import { CategoricalBase } from './CategoricalTW.ts'
import { TwRouter } from './TwRouter.ts'

export class CategoricalCustomGS {
	tw: CatTWCustomGS
	opts: Partial<HandlerOpts>
	base: CategoricalBase
	root: TwRouter

	constructor(fullTw: CatTWCustomGS, opts: HandlerOpts = {}) {
		this.tw = fullTw
		this.opts = opts
		this.base = opts.base
		this.root = opts.root
	}

	static fillQ(tw: RawCatTWCustomGS): CustomGroupSettingQ {
		if (!tw.q.customset) throw `missing tw.q.customset`

		if (tw.q.mode == 'binary') {
			if (tw.q.customset.groups.length != 2) throw 'there must be exactly two groups'
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

		return tw.q
	}
}
