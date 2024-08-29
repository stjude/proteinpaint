import {
	NumericTerm,
	NumericQ,
	NumTWTypes,
	NumTWDiscrete,
	NumTWRegularBin,
	NumTWCustomBin,
	NumTWBinary,
	NumTWCont,
	NumTWSpline,
	RawNumTW,
	DefaultNumericQ,
	DefaultBinnedQ,
	DefaultMedianQ,
	BinaryNumericQ,
	ContinuousNumericQ,
	SplineNumericQ,
	StartUnboundedBin,
	StopUnboundedBin,
	RegularNumericBinConfig,
	CustomNumericBinConfig
} from '#types'
import { TwBase, TwOpts } from './TwBase'
import { copyMerge } from '#rx'
import { isNumeric } from '#shared/helpers'
import { roundValueAuto } from '#shared/roundValue'

const numTermTypes = new Set(['integer', 'float', 'geneExpression', 'metaboliteIntensity'])

export class NumericBase {
	static async fill(tw: RawNumTW, opts: TwOpts = {}): Promise<NumTWTypes> {
		if (!tw.term) throw `missing tw.term, must already be filled in`
		if (
			tw.term.type != 'integer' &&
			tw.term.type != 'float' &&
			tw.term.type != 'geneExpression' &&
			tw.term.type != 'metaboliteIntensity'
		)
			/*if (!numTermTypes.has(tw.term.type))*/ throw `non-numeric term.type='${tw.term.type}'`

		// preprocessing the preferredBins to make sure that subsequent type guard functions
		// have a more filled-in q object to correctly detect the raw tw type. Otherwise,
		// the first type guard will have to perform these steps, which will require the
		// type guard functions to be called in a certain order, not ideal.
		const preferredBins = opts.defaultQ?.preferredBins
		if (preferredBins) {
			if (tw.term.bins[preferredBins]) tw.q = structuredClone(tw.term.bins[preferredBins])
			else if (preferredBins == 'median') {
				if (!isNumeric(opts.defaultQ.median)) {
					const result = await opts.vocabApi.getPercentile(tw.term.id, [50])
					if (!result.values) throw '.values[] missing from vocab.getPercentile()'
					const median = roundValueAuto(result.values[0])
					if (!isNumeric(median)) throw 'median value not a number'
					opts.defaultQ.median = median
				}
			} else {
				// defaultQ is an actual q{} object
				// merge it into tw.q
				copyMerge(tw.q, opts.defaultQ)
			}
		} else if (opts.defaultQ) {
			opts.defaultQ.isAtomic = true
			// merge defaultQ into tw.q
			copyMerge(tw.q, opts.defaultQ)
		}

		if (NumRegularBin.accepts(tw, opts)) return tw
		else if (NumCustomBins.accepts(tw, opts)) return tw
		else if (NumCont.accepts(tw, opts)) return tw
		else if (NumSpline.accepts(tw, opts)) return tw
		// FOR REFERENCE:
		// typescript does not support an async type guard,
		// may use the simply workaround below where the type guard
		// returns a boolean and the return type is coerced
		//else if (await NumTYPE.accepts(tw)) return tw as NumTYPE
		else throw `cannot process the raw numeric tw`
	}
}

export class NumRegularBin extends TwBase {
	term: NumericTerm
	q: RegularNumericBinConfig
	#tw: NumTWRegularBin
	#opts: TwOpts

	// declare a constructor, to narrow the tw type
	constructor(tw: NumTWRegularBin, opts: TwOpts = {}) {
		super(tw, opts)
		this.term = tw.term
		this.q = tw.q
		this.#tw = tw
		this.#opts = opts
	}

	static accepts(tw: RawNumTW, opts: TwOpts = {}): tw is NumTWRegularBin {
		const { term, q } = tw
		if (tw.q.mode == 'continuous' || tw.q.type == 'custom-bin' || tw.q.mode == 'spline') return false
		const defaultQ = opts.defaultQ
		// when missing, defaults mode to discrete
		//const dq = defaultQ as DefaultNumericQ
		if (!tw.q.mode) tw.q.mode = opts.defaultQ?.mode || 'discrete'
		if (!Number.isFinite(tw.q?.bin_size) || !tw.q.first_bin || !Number.isFinite(tw.q.first_bin.stop)) {
			copyMerge(tw.q, tw.term.bins.default)
		}
		if (tw.q.type != 'regular-bin') return false
		if (typeof tw.q.bin_size! !== 'number') throw `q.bin_size is not a number`
		TwBase.setHiddenValues(tw.q as NumericQ, term)
		tw.type = 'NumTWRegularBin' // should be NumTWRegularBins???
		return true
	}
}

export class NumCustomBins extends TwBase {
	term: NumericTerm
	q: CustomNumericBinConfig
	#tw: NumTWCustomBin
	#opts: TwOpts

	// declare a constructor, to narrow the tw type
	constructor(tw: NumTWCustomBin, opts: TwOpts = {}) {
		super(tw, opts)
		this.term = tw.term
		this.q = tw.q
		this.#tw = tw
		this.#opts = opts
	}

	static accepts(tw: RawNumTW, opts: TwOpts = {}): tw is NumTWCustomBin {
		//const { term, q } = tw
		if (tw.q.mode == 'continuous' || tw.q.type == 'regular-bin' || tw.q.mode == 'spline') return false
		if (!tw.q.mode) tw.q.mode = opts.defaultQ?.mode || 'discrete'
		if (tw.q.type != 'custom-bin') return false

		if (opts.defaultQ) {
			opts.defaultQ.isAtomic = true
			const dbq = opts.defaultQ
			if (opts.defaultQ.preferredBins == 'median') {
				const median = opts.defaultQ.median
				if (!isNumeric(median)) throw 'median value not a number'
				const q = JSON.parse(JSON.stringify(opts.defaultQ)) as BinaryNumericQ
				delete tw.q.preferredBins
				delete tw.q.median
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
			}
		}
		if (!tw.q.lst) throw `missing q.lst[] for custom-bin`
		if (tw.q.mode == 'binary' && tw.q.lst.length != 2) throw `numeric q.mode='binary' requires exactly 2 bins`

		TwBase.setHiddenValues(tw.q as NumericQ, tw.term)
		tw.type = 'NumTWCustomBin'
		return true
	}
}

export class NumCont extends TwBase {
	term: NumericTerm
	q: ContinuousNumericQ
	#tw: NumTWCont
	#opts: TwOpts

	// declare a constructor, to narrow the tw type
	constructor(tw: NumTWCont, opts: TwOpts = {}) {
		super(tw, opts)
		this.term = tw.term
		this.q = tw.q
		this.#tw = tw
		this.#opts = opts
	}

	static accepts(tw: RawNumTW, opts: TwOpts = {}): tw is NumTWCont {
		//const { term, q } = tw
		if (tw.q.mode != 'continuous') return false
		tw.type = 'NumTWCont'
		return true
	}
}

export class NumSpline extends TwBase {
	term: NumericTerm
	q: SplineNumericQ
	#tw: NumTWSpline
	#opts: TwOpts

	// declare a constructor, to narrow the tw type
	constructor(tw: NumTWSpline, opts: TwOpts = {}) {
		super(tw, opts)
		this.term = tw.term
		this.q = tw.q
		this.#tw = tw
		this.#opts = opts
	}

	static accepts(tw: RawNumTW, opts: TwOpts = {}): tw is NumTWSpline {
		//const { term, q } = tw
		if (tw.q.mode != 'spline') return false
		if (!tw.q.knots) throw `missing tw.q.knots`
		if (!tw.q.knots.length) throw `empty tw.q.knots[]`

		TwBase.setHiddenValues(tw.q as NumericQ, tw.term)
		tw.type = 'NumTWSpline'
		return true
	}
}
