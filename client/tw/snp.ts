import { TwBase, type TwOpts } from './TwBase.ts'
import { QualValues, QualPredefinedGS, QualCustomGS } from './qualitative.ts'
import type { RawSnpTW, QualTW } from '#types'
import { copyMerge } from '#rx'

export class SnpBase extends TwBase {
	static fill(tw: RawSnpTW, opts: TwOpts): QualTW {
		if (typeof tw.term !== 'object') throw 'tw.term is not an object'
		if (tw.term.type != 'snp') throw `incorrect term.type='${tw.term?.type}', expecting 'snp'`
		if (!tw.term.id || !tw.term.name) throw 'missing snp id/name'
		if (!tw.term.chr || !Number.isInteger(tw.term.start) || !Number.isInteger(tw.term.stop))
			throw 'incomplete position information'
		if (!tw.term.ref || !tw.term.alt) throw 'missing allele information'
		if (!tw.term.groupsetting) tw.term.groupsetting = { disabled: false }

		if (opts.defaultQ != null) {
			opts.defaultQ.isAtomic = true
			// merge defaultQ into tw.q
			copyMerge(tw.q, opts.defaultQ)
		}

		if (!Object.keys(tw.q).includes('type')) tw.q.type = 'values'

		tw.type =
			!tw.q.type || tw.q.type == 'values'
				? 'QualTWValues'
				: tw.q.type == 'predefined-groupset'
				? 'QualTWPredefinedGS'
				: tw.q.type == 'custom-groupset'
				? 'QualTWCustomGS'
				: tw.type

		/*
			For each of fill() functions below:
			1. The `tw` argument must already have a tw.type string value, 
			   which corresponds to the RawSnpTW* equivalent of the full SnpTW* type 

			2. The fill() function must fill-in any expected missing values,
			   validate the tw.q shape at runtime, and throw on any error or mismatched expectation.
			   Runtime validation is required because the input raw tw can come from anywhere,
			   like term.bins.default, which is a runtime variable that is not possible to statically check.
		*/
		switch (tw.type) {
			case 'QualTWValues':
				return QualValues.fill(tw)

			case 'QualTWPredefinedGS':
				return QualPredefinedGS.fill(tw)

			case 'QualTWCustomGS':
				return QualCustomGS.fill(tw)

			default:
				throw `tw.type='${tw.type} (q.mode:q.type=${tw.q.mode}:${tw.q.type}' is not supported by SnpBase.fill()`
		}
	}
}
