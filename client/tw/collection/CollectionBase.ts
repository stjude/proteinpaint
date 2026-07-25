import type {
	TermCollectionTW,
	RawTermCollectionTW,
	RawTermCollectionTWCont,
	RawTermCollectionTWFraction,
	RawTermCollectionTWQual,
	TermCollectionQ
} from '#types'
import type { NumericTermCollection } from './NumericTermCollection'
import type { QualTermCollection } from './QualTermCollection'
import { CollectionCont } from './CollectionCont'
import { CollectionFraction } from './CollectionFraction'
import { CollectionQual } from './CollectionQual'
import { type TwOpts, TwBase } from '../TwBase'

export class CollectionBase extends TwBase {
	term: NumericTermCollection | QualTermCollection
	q: TermCollectionQ

	constructor(tw: TermCollectionTW, opts: TwOpts) {
		super(tw, opts)
		this.type = tw.type
		this.term = tw.term
		this.q = tw.q
	}

	static fill(tw: RawTermCollectionTW, opts: TwOpts = {}): TermCollectionTW {
		const legacyQ = tw.q as any
		if (legacyQ?.type === 'fraction') {
			tw.type = 'TermCollectionTWFraction'
			tw.q =
				legacyQ.mode === 'discrete'
					? ({
							...legacyQ,
							type: 'custom-bin',
							lst: legacyQ.fractionBins,
							denominators: legacyQ.lst
					  } as any)
					: ({
							mode: 'continuous',
							denominators: legacyQ.lst,
							numerators: legacyQ.numerators
					  } as any)
			delete (tw.q as any).fractionBins
		}
		// Term controls may require a different representation for the selected
		// collection. In particular, barchart term2/term0 must resolve a numeric
		// collection to a scalar fraction instead of retaining member values.
		if (opts.defaultQ) tw.q = { ...(tw.q || {}), ...structuredClone(opts.defaultQ) } as any
		if (tw.type === 'TermCollectionTWFraction' || Array.isArray((tw.q as any)?.denominators))
			tw.type = 'TermCollectionTWFraction'

		if (!tw.type) {
			const term = tw.term as any
			if (term.isCustom && term.memberType) {
				// Custom collection: memberType is already on the term, no config lookup needed
				tw.type =
					term.memberType === 'numeric'
						? tw.type === 'TermCollectionTWFraction'
							? 'TermCollectionTWFraction'
							: 'TermCollectionTWCont'
						: 'TermCollectionTWQual'
			} else {
				// Peek at config to determine memberType for routing (full fill happens inside CollectionCont/Qual)
				if (!opts.vocabApi?.termdbConfig?.termCollections)
					throw `missing vocabApi.termdbConfig.termCollections argument for fill()`
				const tc = opts.vocabApi.termdbConfig.termCollections.find((c: { name: string }) => c.name === term.name)
				if (!tc) throw new Error(`no matching termCollection for '${term.name}'`)
				tw.type =
					tc.type === 'numeric'
						? tw.type === 'TermCollectionTWFraction'
							? 'TermCollectionTWFraction'
							: 'TermCollectionTWCont'
						: 'TermCollectionTWQual'
			}
		}

		switch (tw.type) {
			case 'TermCollectionTWCont': {
				CollectionCont.fill(tw as RawTermCollectionTWCont, opts)
				break
			}
			case 'TermCollectionTWFraction': {
				CollectionFraction.fill(tw as RawTermCollectionTWFraction, opts)
				break
			}
			case 'TermCollectionTWQual': {
				CollectionQual.fill(tw as RawTermCollectionTWQual, opts)
				break
			}
			default:
				// should never be reached if TwRouter.fill() routes correctly
				throw `unexpected collection tw.type='${(tw as any).type}'`
		}

		return tw as TermCollectionTW
		//TODO: check tw.q.lst against term.termIds[], should be a subset
	}
}
