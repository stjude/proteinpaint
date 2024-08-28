import { CatTWValues, ValuesQ, CategoricalTerm, CategoricalQ, CatTWPredefinedGS, RawCatTW } from '#types'
import { PlotTwRenderOpts } from '../types'
import { TwBase, TwOpts } from '../TwBase'

export class CatValues extends TwBase {
	term: CategoricalTerm
	q: ValuesQ
	#tw: CatTWValues
	#opts: TwOpts

	// declare a constructor, to narrow the tw type
	constructor(tw: CatTWValues, opts: TwOpts = {}) {
		super(tw, opts)
		this.term = tw.term
		this.q = tw.q
		this.#tw = tw
		this.#opts = opts
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
		// GDC or other dataset may allow missing term.values
		if (!term.values) term.values = {} //throw 'no term.values defined'
		const numVals = Object.keys(tw.term.values).length
		// GDC or other dataset may allow empty term.values
		//if (!numVals) throw `empty term.values`
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
		tw.type = 'CatTWValues'
		return true
	}

	render(arg: PlotTwRenderOpts): void {
		const t = this.term
		for (const [sampleId, d] of Object.entries(arg.data)) {
			const keys = Object.keys(d)
			// lots of terms indicate benchmark testing, no need for string-based svg simulated render
			if (keys.length > 10 || !keys.includes(t.id)) continue
			// for the tw in this typed context, use a svg:circle element
			// note that `this` context guarantees that the tw shape matches
			// expectations without having to do additional checks
			const shape = `<circle r=${d[t.id]}></cicle></svg>`
			arg.holder = arg.holder.replace(`</svg>`, `<text>${sampleId}, ${t.values[d[t.id]].label}</text>${shape}`)

			/*
				*** List of benefits (the goal of this tw routing and handler refactor) ***
				
				All code inside this function can be coded safely againt the type of `this`,
				no need for if-else branches, type casting, or other workarounds.
				
				Consumer code can easily call these added methods easily, without the need
				for static or runtime checks for tw type.
				
				Common methods, for example counting samples by categorical values or groups,
				can also be inherited by specialized handler from a base handler class, therefore
				keeping related logic close together instead of being spread out or duplicated.
			*/
		}
	}
}
