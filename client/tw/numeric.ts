import type { NumericTerm, NumTW, RawNumTW, StartUnboundedBin, StopUnboundedBin } from '#types'
import { TwBase, type TwOpts } from './TwBase.ts'
import { roundValueAuto } from '#shared/roundValue.js'
import { copyMerge } from '#rx'
import { GeneExpBase } from './geneExpression.ts'
import { MetaboliteIntensityBase } from './metaboliteIntensity.ts'
import { DateBase } from './date.ts'
import { SsGSEABase } from './ssGSEA.ts'

export class NumericBase extends TwBase {
	// type is set by TwBase constructor
	term: NumericTerm
	type: 'NumTWRegularBin' | 'NumTWCustomBin' | 'NumTWCont' | 'NumTWBinary' | 'NumTWSpline'
	static termTypes = new Set([
		'integer',
		'float',
		'date',
		'geneExpression',
		'metaboliteIntensity',
		'ssGSEA',
		'singleCellGeneExpression'
	])

	constructor(tw: NumTW, opts: TwOpts) {
		super(tw, opts)
		this.type = tw.type
		this.term = tw.term
	}

	static async fill(tw: RawNumTW, opts: TwOpts = {}): Promise<NumTW> {
		if (!tw.term) throw `missing tw.term, must already be filled in`
		if (!NumericBase.termTypes.has(tw.term.type)) throw `non-numeric term.type='${tw.term.type}'`

		switch (tw.term.type) {
			case 'integer':
			case 'float':
				if (!tw.q.mode) tw.q.mode = 'discrete'
				break

			case 'geneExpression':
				GeneExpBase.fill(tw.term, opts)
				if (!tw.q.mode) tw.q.mode = 'continuous'
				break

			case 'metaboliteIntensity':
				MetaboliteIntensityBase.fill(tw.term)
				if (!tw.q.mode) tw.q.mode = 'continuous'
				break

			case 'date':
				DateBase.fill(tw.term)
				if (!tw.q.mode) tw.q.mode = 'continuous'
				break

			case 'ssGSEA':
				SsGSEABase.fill(tw.term)
				if (!tw.q.mode) tw.q.mode = 'continuous'
				break

			// default:
			// 	// should never be reached if TwRouter.fill() routes correctly
			// 	throw `unexpected numeric term.type='${tw.term.type}'`
		}

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

		// remove q.type for continuous or spline mode
		if (tw.q.mode == 'continuous' || tw.q.mode == 'spline') {
			delete tw.q.type
		} else if (!tw.q.type) {
			if (tw.q.mode == 'binary') tw.q.type = 'custom-bin'
			else if (tw.q.mode == 'discrete') tw.q.type = 'regular-bin'
		}

		if (tw.q.type == 'regular-bin' && tw.term.bins) mayFillQWithPresetBins(tw)

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
			case 'NumTWRegularBin': {
				const { NumRegularBin } = await import('./NumRegularBin.ts')
				return await NumRegularBin.fill(tw, opts)
			}
			case 'NumTWCustomBin': {
				const { NumCustomBins } = await import('./NumCustomBins.ts')
				return await NumCustomBins.fill(tw, opts)
			}
			case 'NumTWCont': {
				const { NumCont } = await import('./NumCont.ts')
				return await NumCont.fill(tw)
			}
			case 'NumTWSpline': {
				const { NumSpline } = await import('./NumSpline.ts')
				return await NumSpline.fill(tw)
			}
			default:
				throw `tw.type='${tw.type} (q.mode:q.type=${tw.q.mode}:${tw.q.type}' is not supported by NumericBase.fill()`
		}
	}

	getTitleText() {
		return this.term.name
	}
}

export async function fillQWithMedianBin(tw, vocabApi) {
	const result = await vocabApi.getPercentile(tw.term, [50], vocabApi.state.termfilter)
	if (!result.values) throw '.values[] missing from vocab.getPercentile()'
	const median = roundValueAuto(result.values[0])

	/* do not check if median is numeric here because median will be null
	if term has no data in dataset, so instead of throwing error, should
	proceed to plot code, which will report to user that no data is available */
	//if (!isNumeric(median)) throw 'median value not a number'

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

export function mayFillQWithPresetBins(tw) {
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
