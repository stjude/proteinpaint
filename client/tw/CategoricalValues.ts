import { CatTWValues, HandlerOpts, ValuesQ, RawCatTWValues } from '#types'
import { CategoricalBase } from './CategoricalTW.ts'
import { TwRouter } from './TwRouter.ts'

export class CategoricalValues {
	tw: CatTWValues
	opts: Partial<HandlerOpts>
	base: CategoricalBase
	root: TwRouter

	constructor(fullTw: CatTWValues, opts: HandlerOpts = {}) {
		this.tw = fullTw
		this.opts = opts
		this.base = opts.base
		this.root = opts.root
	}

	static fillQ(tw: RawCatTWValues): ValuesQ {
		if (!tw.term.values) throw 'no term.values defined'
		const numVals = Object.keys(tw.term.values).length
		if (!numVals) throw `empty term.values`
		if (tw.q.mode == 'binary') {
			if (Object.keys(tw.term.values).length != 2) throw 'term.values must have exactly two keys'
			// TODO:
			// - add validation that both groups have samplecount > 0 or some other minimum count
			// - rough example
			// const data = vocabApi.getCategories() or maybe this.countSamples()
			// if (data.sampleCounts) {
			// 	for (const [k, v] of Object.keys(tw.term.values)) {
			// 		if (!data.sampleCounts.find(d => d.key === key)) {
			//			throw `there are no samples for the required binary value=${key}`
			//    }
			// 	}
			// }
		}
		return { ...tw.q, type: 'values' }
	}
}
