import type { NumericQ, NumTWRegularBin, RawNumTWRegularBin, RegularNumericBinConfig } from '#types'
import { NumericBase, mayFillQWithPresetBins } from './numeric.ts'
import { TwBase, type TwOpts } from './TwBase.ts'
import { isNumeric } from '#shared/helpers.js'

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

	getStatus() {
		return { text: 'bin size=' + this.q.bin_size }
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
