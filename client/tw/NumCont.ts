import type { NumericQ, NumTWCont, RawNumTWCont, ContinuousNumericQ } from '#types'
import { NumericBase } from './numeric.ts'
import { TwBase, type TwOpts } from './TwBase.ts'

export class NumCont extends NumericBase {
	// term, type, isAtomic, $id are set in ancestor base classes
	q: ContinuousNumericQ
	#tw: NumTWCont
	#opts: TwOpts

	// declare a constructor, to narrow the tw type
	constructor(tw: NumTWCont, opts: TwOpts = {}) {
		super(tw, opts)
		//this.term = tw.term // already set by base constructor
		this.q = tw.q
		this.#tw = tw
		this.#opts = opts
	}

	getTw() {
		return this.#tw
	}

	getStatus() {
		return { text: this.q.scale ? `scale=${this.q.scale}` : 'continuous' } // FIXME not effective
	}

	// See the relevant comments in the NumericBase.fill() function above
	static async fill(tw: RawNumTWCont): Promise<NumTWCont> {
		if (!tw.type) tw.type = 'NumTWCont'
		else if (tw.type != 'NumTWCont') throw `expecting tw.type='NumTWCont', got '${tw.type}'`

		if (tw.q.mode != 'continuous') throw `tw.q.mode='${tw.q.mode}', expecting 'continuous'`

		TwBase.setHiddenValues(tw.q as NumericQ, tw.term)
		tw.type = 'NumTWCont'
		return tw as NumTWCont
	}
}
