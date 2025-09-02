import { TwBase, type TwOpts } from './TwBase.ts'
import { NumRegularBin, NumCustomBins, NumCont, NumSpline } from './numeric.ts'
import type { RawGeneExpTW } from '#types'
import { copyMerge } from '#rx'

export class GeneExpBase extends TwBase {
	static async fill(tw: RawGeneExpTW, opts: TwOpts) {
		if (tw.term.type != 'geneExpression') throw 'unexpected term.type'
		if (typeof tw.term !== 'object') throw 'tw.term is not an object'
		if (!tw.term.gene && !tw.term.name) throw 'no gene or name present'
		if (!tw.term.gene) tw.term.gene = tw.term.name
		if (!tw.term.gene || typeof tw.term.gene != 'string') throw 'geneExpression tw.term.gene must be non-empty string'

		if (!tw.term.name) {
			const unit = opts.vocabApi.termdbConfig.queries.geneExpression?.unit || 'Gene Expression'
			const name = `${tw.term.gene} ${unit}`
			tw.term.name = name
		}

		if (opts.defaultQ) copyMerge(tw.q, opts.defaultQ) // override if default is given

		if (!tw.q.mode) {
			tw.q.mode = 'continuous'
		} else if (tw.q.mode == 'discrete') {
			if (!tw.q.type) tw.q.type = 'regular-bin'
		}

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
				throw `tw.type='${tw.type} (q.mode:q.type=${tw.q.mode}:${tw.q.type}' is not supported`
		}
	}
}
