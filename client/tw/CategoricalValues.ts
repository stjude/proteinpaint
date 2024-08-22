import { CatTWValues, HandlerOpts, ValuesQ, RawCatTW, CategoricalTerm } from '#types'
import { CategoricalBase } from './CategoricalTW.ts'
import { Handler } from './Handler'

export class CategoricalValues extends Handler {
	tw: CatTWValues
	base: CategoricalBase

	constructor(fullTw: CatTWValues, opts: HandlerOpts = {}) {
		super(fullTw, opts) // sets this.opts, this.root
		this.tw = fullTw
		this.base = opts.base
	}

	//
	// This function asks the following, to confirm that RawCatTW can be converted to CatTWValues type
	// 1. Can the function process the tw? If false, the tw will be passed by the router to a different specialized filler
	// 2. If true, is the tw valid for processing, is it full or fillable? If not, must throw to stop subsequent processing
	//    of the tw by any other code
	//
	static accepts(tw: RawCatTW): tw is CatTWValues {
		const { term, q } = tw
		if (!q.type) q.type = 'values'
		if (term.type != 'categorical' || q.type != 'values') return false
		if (!term.values) throw 'no term.values defined'
		const numVals = Object.keys(tw.term.values).length
		if (!numVals) throw `empty term.values`
		if (q.mode == 'binary') {
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
		return true
	}
}
