import type { NumericQ, NumTWSpline, RawNumTWSpline, SplineNumericQ } from '#types'
import { NumericBase } from './numeric.ts'
import { TwBase, type TwOpts } from './TwBase.ts'

export class NumSpline extends NumericBase {
	// term, type, isAtomic, $id are set in ancestor base classes
	q: SplineNumericQ
	#tw: NumTWSpline
	#opts: TwOpts

	// declare a constructor, to narrow the tw type
	constructor(tw: NumTWSpline, opts: TwOpts = {}) {
		super(tw, opts)
		//this.term = tw.term // already set by base constructor
		this.q = tw.q
		this.#tw = tw
		this.#opts = opts
	}

	getStatus() {
		return { text: 'cubic spline' }
	}

	static async fill(tw: RawNumTWSpline): Promise<NumTWSpline> {
		if (!tw.type) tw.type = 'NumTWSpline'
		else if (tw.type != 'NumTWSpline') throw `expecting tw.type='NumTWSpline', got '${tw.type}'`

		if (tw.q.mode != 'spline') throw `tw.q.mode='${tw.q.mode}', expecting 'spline'`
		if (!tw.q.knots) throw `missing tw.q.knots`
		if (!tw.q.knots.length) throw `empty tw.q.knots[]`

		TwBase.setHiddenValues(tw.q as NumericQ, tw.term)
		tw.type = 'NumTWSpline'
		return tw as NumTWSpline
	}
}
