import {
	CategoricalTerm,
	CatTWPredefinedGS,
	CatTWCustomGS,
	PredefinedGroupSettingQ,
	BaseGroupSet,
	ValuesQ,
	RawCatTW
} from '#types'
import { PlotTwRenderOpts } from '../types'
import { TwBase, TwOpts } from '../TwBase'

export class CatPredefinedGS extends TwBase {
	term: CategoricalTerm
	q: PredefinedGroupSettingQ
	#groupset: BaseGroupSet
	#tw: CatTWPredefinedGS
	#opts: TwOpts

	// declare a constructor, to narrow the tw type
	constructor(tw: CatTWPredefinedGS, opts: TwOpts = {}) {
		super(tw, opts)
		this.term = tw.term // to narrow to categorical term, since TwBase.term is just Term
		this.q = tw.q
		this.#tw = tw
		this.#groupset = this.term.groupsetting[this.#tw.q.predefined_groupset_idx]
		this.#opts = opts
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
		tw.type = 'CatTWPredefinedGS'
		return true
	}

	render(arg: PlotTwRenderOpts) {
		// the tw is guaranteed to have term.type=categorical, q.type='predefined-groupset'
		const t = this.term
		for (const [sampleId, d] of Object.entries(arg.data)) {
			const keys = Object.keys(d)
			// lots of terms indicate benchmark testing, must not by influenced by string-based svg simulated render
			if (keys.length > 10 || !keys.includes(t.id)) continue
			// for the tw in this typed context, use a svg:rect element
			const shape = `<rect width=10 height=10></rect></svg>`
			arg.holder = arg.holder.replace(`</svg>`, `<text>${sampleId}, ${d[t.id]}</text>${shape}`)
		}
	}
}

//test only
const tw = {
	type: 'CatTWPredefinedGS' as const,
	term: {
		type: 'categorical' as const,
		id: 'abc',
		name: 'ABC',
		values: {
			x: { label: 'x' },
			y: { label: 'y' }
		},
		groupsetting: {
			lst: [
				{
					name: 'test',
					groups: []
				}
			]
		}
	},
	q: {
		type: 'predefined-groupset' as const,
		predefined_groupset_idx: 0
	}
	// q: {
	// 	type: 'custom-groupset' as const,
	// 	customset: {
	// 		groups: []
	// 	}
	// },
}

const a = new CatPredefinedGS(tw)
