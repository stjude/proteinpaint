import {
	NumericTerm,
	NumericQ,
	NumTWTypes,
	NumTWRegularBin,
	NumTWCustomBin,
	NumTWCont,
	NumTWSpline,
	RawNumTW,
	RawNumTWRegularBin,
	RawNumTWCustomBin,
	RawNumTWCont,
	RawNumTWSpline,
	ContinuousNumericQ,
	SplineNumericQ,
	StartUnboundedBin,
	StopUnboundedBin,
	RegularNumericBinConfig,
	CustomNumericBinConfig
} from '#types'
import { TwBase, TwOpts } from './TwBase.ts'
import { copyMerge } from '#rx'
import { isNumeric } from '#shared/helpers'
import { roundValueAuto } from '#shared/roundValue'

export class NumericBase extends TwBase {
	// type is set by TwBase constructor
	term: NumericTerm
	static termTypes = new Set(['integer', 'float', 'geneExpression', 'metaboliteIntensity'])

	constructor(tw: NumTWTypes, opts: TwOpts) {
		super(tw, opts)
		this.term = tw.term
	}

	static async fill(tw: RawNumTW, opts: TwOpts = {}): Promise<NumTWTypes> {
		if (!tw.term) throw `missing tw.term, must already be filled in`
		if (!NumericBase.termTypes.has(tw.term.type)) throw `non-numeric term.type='${tw.term.type}'`

		// preprocessing the preferredBins to make sure that subsequent fill() functions
		// have a more filled-in q object to correctly detect the raw tw type.
		if (opts.defaultQ) opts.defaultQ.isAtomic = true
		const preferredBins = opts.defaultQ?.preferredBins
		if (preferredBins) {
			const q = opts.defaultQ
			if (tw.term.bins[preferredBins]) {
				tw.q = structuredClone(tw.term.bins[preferredBins])
				delete q.preferredBins
			} else if (preferredBins == 'median') {
				if (q.type != 'custom-bin') throw '.type must be custom-bin when .preferredBins=median'
				Object.assign(tw.q, q)
			} else {
				throw `unrecognized defaultQ.preferredBins='${preferredBins}'`
			}
		} else {
			if (opts.defaultQ) {
				opts.defaultQ.isAtomic = true
				tw.q.isAtomic = true
				// merge defaultQ into tw.q
				if (tw.q.mode != opts.defaultQ.mode) copyMerge(tw.q, opts.defaultQ)
			}

			if (tw.term.bins) {
				// detect if tw.q still needs to use term.bins
				//
				// TODO: may move some of these logic in the applicable switch-case code block,
				//       which may require not allowwing "mixed-modes", like some code expecting
				//       q.type='regular-bin' to possibly have q.mode='binary' | 'continuous',
				//       should clean or clarify such usecases
				//
				if (!tw.q.type) {
					// a missing q.type indicates that tw.q needs to be filled-in
					if (tw.q.mode != 'continuous' && tw.q.mode != 'spline') {
						// only use bins.default if the q.mode matches (assumed to be discrete)
						copyMerge(tw.q, structuredClone(tw.term.bins.default))
					}
				} else if (tw.q.type === tw.term.bins.default.type) {
					// only fill-in tw.q if it's missing properties,
					// otherwise assume that a full tw.q should not be overriden by term.bins
					if (tw.q.type == 'regular-bin') {
						if (!isNumeric(tw.q.bin_size) || !tw.q.first_bin || !isNumeric(tw.q.first_bin.stop)) {
							// tw.q is still missing required props
							tw.q = structuredClone(tw.term.bins.default)
						}
					} else if (tw.q.type == 'custom-bin' && !Array.isArray(tw.q.lst)) {
						// tw.q is still missing required props
						tw.q = structuredClone(tw.term.bins.default)
					}
				}
			}
		}

		/* 
			Pre-fill the tw.type, since it's required for ROUTING to the
			correct fill() function. Tsc will be able to use tw.type as a 
			discriminant property for the RawNumTW union type, enabling 
			static type checks on the input raw tw.

			NOTE: tw.type is NOT required when calling a specialized fill() 
			function directly, outside of TwRouter.fill(). The input tw.type
			does not have to be discriminated in that case.
		*/
		//if (!tw.type)
		tw.type =
			tw.q.type == 'regular-bin'
				? 'NumTWRegularBin'
				: tw.q.type == 'custom-bin' || tw.q.mode == 'binary'
				? 'NumTWCustomBin'
				: tw.q.mode == 'continuous'
				? 'NumTWCont'
				: tw.q.mode == 'spline'
				? 'NumTWSpline'
				: tw.type

		/*
			For each of fill() functions below:
			1. The `tw` argument must already have a tw.type string value, 
			   which corresponds to the RawNumTW* equivalent of the full NumTW* type 

			2. The fill() function must fill-in any expected missing values,
			   validate the tw.q shape at runtime, and throw on any error or mismatched expectation.
			   Runtime validation is required because the input raw tw can come from anywhere,
			   like term.bins.default, which is a runtime variable that is not possible to statically check.

			3. The filled-in tw, when returned, must be **coerced** to the full NumTW* type, 
			   in order to match the function signature's return type.
		*/
		switch (tw.type) {
			case 'NumTWRegularBin':
				return await NumRegularBin.fill(tw)

			case 'NumTWCustomBin':
				tw.q.type = 'custom-bin'
				return await NumCustomBins.fill(tw, opts)

			case 'NumTWCont':
				return await NumCont.fill(tw)

			case 'NumTWSpline':
				return await NumSpline.fill(tw)

			default:
				throw `tw.type='${tw.type} (q.mode:q.type=${tw.q.mode}:${tw.q.type}' is not supported by NumericBase.fill()`
		}
	}
}

export class NumRegularBin extends NumericBase {
	// type, isAtomic, $id are set in ancestor base classes
	q: RegularNumericBinConfig
	#tw: NumTWRegularBin
	#opts: TwOpts

	// declare a constructor, to narrow the tw type
	constructor(tw: NumTWRegularBin, opts: TwOpts = {}) {
		super(tw, opts)
		//this.term = tw.term // already set by base constructor
		this.q = tw.q
		this.#tw = tw
		this.#opts = opts
	}

	getTw() {
		return this.#tw
	}

	// See the relevant comments in the NumericBase.fill() function above
	static async fill(tw: RawNumTWRegularBin): Promise<NumTWRegularBin> {
		if (!tw.type) tw.type = 'NumTWRegularBin'
		else if (tw.type != 'NumTWRegularBin') throw `expecting tw.type='NumTWRegularBin', got '${tw.type}'`

		if (!tw.q.mode) tw.q.mode = 'discrete'
		else if (tw.q.mode != 'discrete' && tw.q.mode != 'binary' && tw.q.mode != 'continuous')
			throw `expecting tw.q.mode='discrete'|'binary'|'continous', got '${tw.q.mode}'`

		if (tw.q.type && tw.q.type != 'regular-bin') throw `expecting tw.q.type='regular-bin', got '${tw.q.type}'`

		if (!isNumeric(tw.q.bin_size)) throw `tw.q.bin_size=${tw.q.bin_size} is not numeric`
		if (!tw.q.first_bin) throw `missing tw.q.first_bin`
		if (!isNumeric(tw.q.first_bin?.stop)) throw `tw.q.first_bin.stop is not numeric`

		TwBase.setHiddenValues(tw.q as NumericQ, tw.term)
		return tw as NumTWRegularBin
	}
}

export class NumCustomBins extends NumericBase {
	// term, type, isAtomic, $id are set in ancestor base classes
	q: CustomNumericBinConfig
	#tw: NumTWCustomBin
	#opts: TwOpts

	// declare a constructor, to narrow the tw type
	constructor(tw: NumTWCustomBin, opts: TwOpts = {}) {
		super(tw, opts)
		//this.term = tw.term // already set by base constructor
		this.q = tw.q
		this.#tw = tw
		this.#opts = opts
	}

	getTw() {
		return this.#tw
	}

	// See the relevant comments in the NumericBase.fill() function above
	static async fill(tw: RawNumTWCustomBin, opts: TwOpts = {}): Promise<NumTWCustomBin> {
		if (!tw.type) tw.type = 'NumTWCustomBin'
		else if (tw.type != 'NumTWCustomBin') throw `expecting tw.type='NumTWCustomBin', got '${tw.type}'`

		if (!tw.q.mode) tw.q.mode = 'discrete'
		else if (tw.q.mode != 'discrete' && tw.q.mode != 'binary')
			throw `expecting tw.q.mode='discrete'|binary', got '${tw.q.mode}'`

		if (tw.q.type != 'custom-bin') throw `expecting tw.q.type='custom-bin', got '${tw.q.type}'`

		if (tw.q.preferredBins == 'median') {
			let median
			if (tw.q.median) {
				median = tw.q.median
				delete tw.q.median
			} else {
				const result = await opts.vocabApi.getPercentile(tw.term.id, [50])
				if (!result.values) throw '.values[] missing from vocab.getPercentile()'
				median = roundValueAuto(result.values[0])
			}
			if (!isNumeric(median)) throw 'median value not a number'
			tw.q.lst = [
				{
					startunbounded: true,
					stop: median,
					stopinclusive: false,
					label: '<' + median // if label is missing, cuminc will break with "unexpected seriesId", cuminc.js:367
				} as StartUnboundedBin,
				{
					start: median,
					startinclusive: true,
					stopunbounded: true,
					label: '≥' + median
				} as StopUnboundedBin
			]
			delete tw.q.preferredBins
		}

		if (!tw.q.lst) throw `missing q.lst[] for custom-bin`
		if (tw.q.mode == 'binary' && tw.q.lst.length != 2) throw `numeric q.mode='binary' requires exactly 2 bins`

		TwBase.setHiddenValues(tw.q as NumericQ, tw.term)
		tw.type = 'NumTWCustomBin'
		return tw as NumTWCustomBin
	}
}

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
