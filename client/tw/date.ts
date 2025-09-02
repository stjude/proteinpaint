import { TwBase, type TwOpts } from './TwBase.ts'
import { NumRegularBin, NumCustomBins, NumCont } from './numeric.ts'
import type { RawDateTW } from '#types'
import { copyMerge } from '#rx'

export class DateBase extends TwBase {
	static async fill(tw: RawDateTW, opts: TwOpts) {
		if (tw.term.type != 'date') throw 'unexpected term.type'
		if (typeof tw.term !== 'object') throw 'tw.term is not an object'

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
				: tw.type

		switch (tw.type) {
			case 'NumTWRegularBin':
				return await NumRegularBin.fill(tw, opts)

			case 'NumTWCustomBin':
				return await NumCustomBins.fill(tw, opts)

			case 'NumTWCont':
				return await NumCont.fill(tw)

			default:
				throw `tw.type='${tw.type} (q.mode:q.type=${tw.q.mode}:${tw.q.type}' is not supported`
		}
	}
}
