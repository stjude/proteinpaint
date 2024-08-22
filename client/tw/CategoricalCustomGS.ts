import { CatTWCustomGS, HandlerOpts, CustomGroupSettingQ, RawCustomGroupsetQ, CategoricalTerm, RawCatTW } from '#types'
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

	//
	// This function asks the following, to confirm that RawCatTW can be converted to CatTWCustomGS type
	// 1. Can the function process the tw? If false, the tw will be passed by the router to a different specialized filler
	// 2. If true, is the tw valid for processing, is it full or fillable? If not, must throw to stop subsequent processing
	//    of the tw by any other code
	//
	static accepts(tw: RawCatTW): tw is CatTWCustomGS {
		const { term, q } = tw
		if (term.type != 'categorical' || q.type != 'custom-groupset') return false
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

		return true
	}
}
