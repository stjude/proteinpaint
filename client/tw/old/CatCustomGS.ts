import { CategoricalTerm, CatTWCustomGS, CustomGroupSettingQ, BaseGroupSet, ValuesQ, RawCatTW } from '#types'
//import { PlotTwRenderOpts } from '../types'
import { TwBase, TwOpts } from '../TwBase'

export class CatCustomGS extends TwBase {
	term: CategoricalTerm
	q: CustomGroupSettingQ
	#groupset: BaseGroupSet
	#tw: CatTWCustomGS
	#opts: TwOpts

	// declare a constructor, to narrow the tw type
	constructor(tw: CatTWCustomGS, opts: TwOpts = {}) {
		super(tw, opts)
		this.term = tw.term // to narrow to categorical term, since TwBase.term is just Term
		this.q = tw.q
		this.#groupset = this.q.customset
		this.#tw = tw
		this.#opts = opts
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
		tw.type = 'CatTWCustomGS'
		return true
	}

	// render(arg: PlotTwRenderOpts) {
	// 	// the tw is guaranteed to have term.type=categorical, q.type='predefined-groupset'
	// 	const t = this.term
	// 	for (const [sampleId, d] of Object.entries(arg.data)) {
	// 		const keys = Object.keys(d)
	// 		// lots of terms indicate benchmark testing, must not by influenced by string-based svg simulated render
	// 		if (keys.length > 10 || !keys.includes(t.id)) continue
	// 		// for the tw in this typed context, use a svg:rect element
	// 		const shape = `<rect width=10 height=10></rect></svg>`
	// 		arg.holder = arg.holder.replace(`</svg>`, `<text>${sampleId}, ${d[t.id]}</text>${shape}`)
	// 	}
	// }
}

//test only
const tw = {
	type: 'CatTWCustomGS' as const,
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
		type: 'custom-groupset' as const,
		customset: {
			groups: []
		}
	}
}

const a = new CatCustomGS(tw)
