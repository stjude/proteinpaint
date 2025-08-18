import { fillQWithMedianBin } from './numeric.ts'
import { TwBase, type TwOpts } from './TwBase.ts'
import type { GeneExpressionTW, CustomNumericBinConfig } from '#types'
import { copyMerge } from '#rx'

export class GeneExpBase extends TwBase {
	static async fill(tw: GeneExpressionTW, opts: TwOpts) {
		if (typeof tw.term !== 'object') throw 'tw.term is not an object'
		if (!tw.term.gene && !tw.term.name) throw 'no gene or name present'
		if (!tw.term.gene) tw.term.gene = tw.term.name
		if (!tw.term.gene || typeof tw.term.gene != 'string') throw 'geneExpression tw.term.gene must be non-empty string'

		if (!tw.term.name) tw.term.name = tw.term.gene // auto fill if .name is missing

		if (!tw.q?.mode) tw.q = { mode: 'continuous' } // supply default q if missing
		if (opts.defaultQ) copyMerge(tw.q, opts.defaultQ) // override if default is given

		if (tw.q.preferredBins == 'median') {
			const q = tw.q as CustomNumericBinConfig
			if (!q.lst?.length) await fillQWithMedianBin(tw, opts.vocabApi)
		}

		if (tw.q.mode !== 'continuous' && !tw.term.bins) {
			/* gene term is missing bin definition, this is expected as it's not valid to apply same bin to genes with vastly different exp range,
			and not worth it to precompute each gene's default bin with its actual exp data as cohort filter can not be predicted
			here make a request to determine default bin for this term based on its data

			do not do this when tw.q.mode is continuous:
			1. it will add significant delay to gene exp clustering, esp for gdc. bins are useless for hiercluster and the request will lock up server
			2. the way setTermBins works, tw.q.type won't be filled and errors out
			*/
			await opts.vocabApi.setTermBins(tw)
		}

		// TODO: may create more specific GeneExpTW* tw.type, but only as needed,
		//       using a numeric tw.type is likely sufficient for now
		tw.type =
			tw.q.type == 'regular-bin'
				? 'NumTWRegularBin'
				: tw.q.type == 'custom-bin' //|| tw.q.mode == 'binary'
				? 'NumTWCustomBin'
				: tw.q.mode == 'continuous'
				? 'NumTWCont'
				: tw.q.mode == 'spline'
				? 'NumTWSpline'
				: tw.type

		return tw
	}
}
