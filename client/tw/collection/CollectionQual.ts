import { TermCollection } from './TermCollection'
import { TwBase, type TwOpts } from '../TwBase'
import type { TermCollectionQQual, RawTermCollectionTWQual, TermCollectionTWQual } from '#types'

export class CollectionQual extends TwBase {
	term: TermCollection
	q: TermCollectionQQual

	static fill(tw: RawTermCollectionTWQual, opts: TwOpts = {}): TermCollectionTWQual {
		TermCollection.fill(tw.term, opts)
		// Normalize raw tw.type ('termCollection' or missing) to canonical type
		tw.type = 'TermCollectionTWQual'

		if (!tw.q) tw.q = { mode: 'discrete', type: 'values', lst: [], categoryKeys: tw.term.categoryKeys }
		else {
			if (!tw.q.mode) tw.q.mode = 'discrete'
			if (!tw.q.lst) tw.q.lst = tw.term.termIds || []
			if (!tw.q.categoryKeys) tw.q.categoryKeys = tw.term.categoryKeys
		}

		return tw as TermCollectionTWQual
		//TODO: check tw.q.lst against term.lst, should be a subset
	}

	constructor(tw: TermCollectionTWQual, opts: TwOpts) {
		super(tw, opts)
		this.term = tw.term
		this.q = tw.q
	}

	getMinCopy() {
		const tw = this.getTw()
		const copy: any = { term: {}, q: structuredClone(tw.q) }
		if (tw.$id) copy.$id = tw.$id
		if (tw.term) {
			copy.term.type = tw.term.type
			copy.term.name = tw.term.name
			if ((tw.term as any).id) copy.term.id = (tw.term as any).id
			if ((tw.term as any).collectionId) copy.term.collectionId = (tw.term as any).collectionId
			if ((tw.term as any).memberType) copy.term.memberType = (tw.term as any).memberType
			if ((tw.term as any).categoryKeys) copy.term.categoryKeys = structuredClone((tw.term as any).categoryKeys)
			if ((tw.term as any).numerators) copy.term.numerators = structuredClone((tw.term as any).numerators)
			if ((tw.term as any).propsByTermId) copy.term.propsByTermId = structuredClone((tw.term as any).propsByTermId)
			copy.term.termIds = (tw.term as any).termlst?.map((t: any) => t.id) || []
		}
		if (copy.q) {
			delete copy.q.isAtomic
		}
		return copy
	}
}
