import type { TermCollectionTW, RawTermCollectionTW, TermCollectionQ } from '#types'
import { TermCollection } from './TermCollection'
import { CollectionCont } from './CollectionCont'
import { CollectionQual } from './CollectionQual'
import { type TwOpts, TwBase } from '../TwBase'

export class CollectionBase extends TwBase {
	term: TermCollection
	q: TermCollectionQ

	constructor(tw: TermCollectionTW, opts: TwOpts) {
		super(tw, opts)
		this.type = tw.type
		this.term = tw.term
		this.q = tw.q
	}

	static fill(tw: RawTermCollectionTW, opts: TwOpts = {}): TermCollectionTW {
		TermCollection.fill(tw.term, opts)

		if (!tw.type) {
			tw.type = tw.term.memberType == 'numeric' ? 'TermCollectionTWCont' : 'TermCollectionTWQual'
		}

		switch (tw.type) {
			case 'TermCollectionTWCont': {
				CollectionCont.fill(tw, opts)
				break
			}
			case 'TermCollectionTWQual': {
				CollectionQual.fill(tw, opts)
				break
			}
			default:
				// should never be reached if TwRouter.fill() routes correctly
				throw `unexpected collection tw.term.memberType='${(tw.term as any).memberType}'`
		}

		// // Normalize raw tw.type ('termCollection' or missing) to canonical type
		// if (!tw.type || tw.type === 'termCollection') tw.type = 'TermCollectionTWCont'

		// // TODO: when more termCollection types needed, should assign different q.type here.
		// if (!tw.q) tw.q = { mode: 'continuous', type: 'values', lst: [] }
		// else {
		// 	if (!tw.q.mode) tw.q.mode = 'continuous'
		// 	if (!tw.q.lst) tw.q.lst = []
		// }

		// //if (!tw.q.lst?.length) throw `invalid tw.q.lst[]`

		return tw as TermCollectionTW
		//TODO: check tw.q.lst against term.lst, should be a subset
	}
}
