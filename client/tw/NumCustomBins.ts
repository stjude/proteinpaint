import type { NumericQ, NumTWCustomBin, RawNumTWCustomBin, CustomNumericBinConfig } from '#types'
import { NumericBase, fillQWithMedianBin, mayFillQWithPresetBins } from './numeric.ts'
import { TwBase, type TwOpts } from './TwBase.ts'

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

	getStatus(opts?: any, data?: any) {
		if (this.q.mode == 'binary') {
			const regressionStatus =
				opts.usecase?.target == 'regression' && this.q.lst.find(x => x.label != data.refGrp)?.label
			return { text: regressionStatus || 'binary' }
		}
		return { text: this.q.lst.length + ' bins' }
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
