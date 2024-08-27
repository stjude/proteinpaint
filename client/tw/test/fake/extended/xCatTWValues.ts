import { CatTWValues, ValuesQ, CategoricalTerm, CategoricalQ, CatTWPredefinedGS } from '#types'
import { HandlerOpts } from '../../../Handler'
import { PlotTwRenderOpts } from '../types'
import { TwBase } from '../../../TwBase'

export class xCatTWValues extends TwBase {
	term: CategoricalTerm
	q: ValuesQ
	#tw: CatTWValues
	#opts: HandlerOpts

	// declare a constructor, to narrow the tw type
	constructor(tw: CatTWValues, opts: HandlerOpts = {}) {
		super(tw, opts)
		this.term = tw.term
		this.q = tw.q
		this.#tw = tw
		this.#opts = opts
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
