import type {
	TermCollectionTW,
	RawTermCollectionTW,
	RawTermCollectionTWCont,
	RawTermCollectionTWQual,
	TermCollectionQ
} from '#types'
import type { NumericTermCollection } from './NumericTermCollection'
import type { QualTermCollection } from './QualTermCollection'
import { CollectionCont } from './CollectionCont'
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
		if (!tw.type) {
			// Peek at config to determine memberType for routing (full fill happens inside CollectionCont/Qual)
			if (!opts.vocabApi?.termdbConfig?.termCollections)
				throw `missing vocabApi.termdbConfig.termCollections argument for fill()`
			const term = tw.term
			const tc = opts.vocabApi.termdbConfig.termCollections.find((c: { name: string }) => c.name === term.name)
			if (!tc) throw new Error(`no matching termCollection for '${term.name}'`)
			tw.type = tc.type === 'numeric' ? 'TermCollectionTWCont' : 'TermCollectionTWQual'
		}

		switch (tw.type) {
			case 'TermCollectionTWCont': {
				CollectionCont.fill(tw as RawTermCollectionTWCont, opts)
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
