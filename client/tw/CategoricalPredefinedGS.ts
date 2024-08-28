import {
	CatTWPredefinedGS,
	CategoricalTerm,
	RawCatTW,
	CategoricalTW,
	PredefinedGroupSettingQ,
	RawPredefinedGroupsetQ
} from '#types'
import { CategoricalRouter } from './CategoricalRouter.ts'
import { Handler, HandlerOpts } from './Handler'
import { set_hiddenvalues } from '#termsetting'

export class CategoricalPredefinedGS extends Handler {
	tw: CatTWPredefinedGS
	router: CategoricalRouter

	constructor(fullTw: CatTWPredefinedGS, opts: HandlerOpts = {}) {
		super(fullTw, opts) // sets this.opts, this.root
		this.tw = fullTw
		this.router = opts.router
	}

	//
	// This function asks the following, to confirm that RawCatTW can be converted to a CatTWPredefinedGS type
	// 1. Can the function process the tw? If false, the tw will be passed by the router to a different specialized filler
	// 2. If true, is the tw valid for processing, is it full or fillable? If not, must throw to stop subsequent processing
	//    of the tw by any other code
	//
	static accepts(tw: RawCatTW): tw is CatTWPredefinedGS {
		const { term, q } = tw
		if (term.type != 'categorical' || q.type != 'predefined-groupset') return false
		const i = q.predefined_groupset_idx
		if (i !== undefined && !Number.isInteger(i)) throw `missing or invalid tw.q.predefined_groupset_idx='${i}'`
		q.predefined_groupset_idx = i || 0
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
		set_hiddenvalues(q, term)
		return true
	}
}
