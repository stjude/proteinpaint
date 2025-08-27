import type {
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
import { TwBase, type TwOpts } from './TwBase.ts'
import { isNumeric } from '#shared/helpers.js'
import { roundValueAuto } from '#shared/roundValue.js'
import { copyMerge } from '#rx'

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

		if (opts.defaultQ) {
			opts.defaultQ.isAtomic = true
			tw.q.isAtomic = true
			if (opts.defaultQ.preferredBins == 'median') {
				if (!opts.defaultQ.type) opts.defaultQ.type = 'custom-bin'
				else if (opts.defaultQ.type != 'custom-bin') throw '.type must be custom-bin when .preferredBins=median'
			}
			// merge defaultQ into tw.q
			copyMerge(tw.q, opts.defaultQ)
		}

		if (!tw.q.mode) tw.q.mode = 'discrete'

		// fill q.type for binary or discrete mode to enable routing
		if ((tw.q.mode == 'discrete' || tw.q.mode == 'binary') && !tw.q.type) {
			if (tw.q.mode == 'binary') tw.q.type = 'custom-bin'
			else if (tw.q.mode == 'discrete') mayFillQWithPresetBins(tw)
		}

		// remove q.type for continuous or spline mode
		if (tw.q.mode == 'continuous' || tw.q.mode == 'spline') delete tw.q.type

		/* 
			Pre-fill the tw.type, since it's required for ROUTING to the
			correct fill() function. Tsc will be able to use tw.type as a 
			discriminant property for the RawNumTW union type, enabling 
			static type checks on the input raw tw.

			NOTE: tw.type is NOT required when calling a specialized fill() 
			function directly, outside of TwRouter.fill(). The input tw.type
			does not have to be discriminated in that case.
		*/
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
				return await NumRegularBin.fill(tw, opts)

			case 'NumTWCustomBin':
				return await NumCustomBins.fill(tw, opts)

			case 'NumTWCont':
				return await NumCont.fill(tw)

			case 'NumTWSpline':
				return await NumSpline.fill(tw)

			default:
				throw `tw.type='${tw.type} (q.mode:q.type=${tw.q.mode}:${tw.q.type}' is not supported by NumericBase.fill()`
		}
	}

	getTitleText() {
		return this.term.name
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
	static async fill(tw: RawNumTWRegularBin, opts: TwOpts = {}): Promise<NumTWRegularBin> {
		if (!tw.type) tw.type = 'NumTWRegularBin'
		else if (tw.type != 'NumTWRegularBin') throw `expecting tw.type='NumTWRegularBin', got '${tw.type}'`

		if (!tw.q.mode) tw.q.mode = 'discrete'
		else if (tw.q.mode != 'discrete' && tw.q.mode != 'binary' && tw.q.mode != 'continuous')
			throw `expecting tw.q.mode='discrete'|'binary'|'continous', got '${tw.q.mode}'`

		if (tw.q.type && tw.q.type != 'regular-bin') throw `expecting tw.q.type='regular-bin', got '${tw.q.type}'`

		if (!tw.term.bins) {
			/* non-dictionary term (e.g. gene term) may be missing bin definition, this is expected as it's not valid to apply same bin to genes with vastly different exp range,
			and not worth it to precompute each gene's default bin with its actual exp data as cohort filter can not be predicted
			here make a request to determine default bin for this term based on its data

			do not do this when tw.q.mode is continuous:
			1. it will add significant delay to gene exp clustering, esp for gdc. bins are useless for hiercluster and the request will lock up server
			2. the way setTermBins works, tw.q.type won't be filled and errors out
			*/
			await opts.vocabApi.setTermBins(tw)
		}

		if (!tw.q.first_bin || !isNumeric(tw.q.bin_size)) mayFillQWithPresetBins(tw)

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
		else if (tw.q.mode != 'discrete' && tw.q.mode != 'binary' && tw.q.mode != 'continuous')
			throw `expecting tw.q.mode='discrete'|binary|continuous', got '${tw.q.mode}'`

		if (tw.q.mode == 'binary' && !tw.q.preferredBins) tw.q.preferredBins = 'median'

		if (!tw.term.bins) {
			/* non-dictionary term (e.g. gene term) may be missing bin definition, this is expected as it's not valid to apply same bin to genes with vastly different exp range,
			and not worth it to precompute each gene's default bin with its actual exp data as cohort filter can not be predicted
			here make a request to determine default bin for this term based on its data

			do not do this when tw.q.mode is continuous:
			1. it will add significant delay to gene exp clustering, esp for gdc. bins are useless for hiercluster and the request will lock up server
			2. the way setTermBins works, tw.q.type won't be filled and errors out
			*/
			await opts.vocabApi.setTermBins(tw)
		}

		if (tw.q.preferredBins == 'median' && !tw.q.lst?.length) await fillQWithMedianBin(tw, opts.vocabApi)
		else if (tw.q.type != 'custom-bin') throw `expecting tw.q.type='custom-bin', got '${tw.q.type}'`

		if (!Array.isArray(tw.q.lst)) mayFillQWithPresetBins(tw)

		if (!tw.q.lst || !tw.q.lst.length) throw `missing or empty q.lst[] for custom-bin`
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

export async function fillQWithMedianBin(tw, vocabApi) {
	const result = await vocabApi.getPercentile(tw.term, [50], vocabApi.state.termfilter)
	if (!result.values) throw '.values[] missing from vocab.getPercentile()'
	const median = roundValueAuto(result.values[0])

	if (!isNumeric(median)) throw 'median value not a number'
	tw.q.type = 'custom-bin'
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

const validPreferredBins = new Set(['default', 'less', 'median'])

function mayFillQWithPresetBins(tw) {
	if (!tw.term.bins) throw `missing tw.term.bins`
	// preprocessing the preferredBins to make sure that q.type is set
	// and can be used to route the raw tw to the correct subclass fill() function
	const preferredBins = tw.q.preferredBins || 'default'
	if (!validPreferredBins.has(preferredBins)) throw `invalid preferredBins='${preferredBins}'`
	if (preferredBins != 'median') {
		if (!Object.keys(tw.term.bins).includes(preferredBins))
			throw `term.bins does not have a preset '${preferredBins}' key`
		const bins = tw.term.bins[preferredBins]
		if (tw.q.type && tw.q.type != bins.type) throw `mismatched tw.q.type and term.bins[preferredBins].type`
		const qkeys = Object.keys(tw.q)
		for (const [k, v] of Object.entries(bins)) {
			// only override tw.q values that don't already exist in tw.q;
			// NOTES:
			// - Object.hasOwn(tw.q, k) will work with lib: ["es2022"], but that causes other tsc errors
			// - using tw.q.hasOwnProperty(k) causes an eslint error, no-prototype-builtins
			if (!qkeys.includes(k)) tw.q[k] = v
		}
		delete tw.q.preferredBins
	}
}
