import { QualTermCollection } from './QualTermCollection'
import { TwBase, type TwOpts } from '../TwBase'
import type { TermCollectionQQual, RawTermCollectionTWQual, TermCollectionTWQual } from '#types'

export class CollectionQual extends TwBase {
	term: QualTermCollection
	q: TermCollectionQQual

	static fill(tw: RawTermCollectionTWQual, opts: TwOpts = {}): TermCollectionTWQual {
		QualTermCollection.fill(tw.term, opts)
		tw.type = 'TermCollectionTWQual'

		if (!tw.q) tw.q = { mode: 'discrete', type: 'values', lst: [] }
		else {
			if (!tw.q.mode) tw.q.mode = 'discrete'
			if (!tw.q.lst) tw.q.lst = tw.term.termIds || []
		}
		if (!tw.q.categoryKeys && tw.term.categoryKeys?.length) {
			tw.q.categoryKeys = structuredClone(tw.term.categoryKeys)
		}

		return tw as TermCollectionTWQual
		//TODO: check tw.q.lst against term.termIds[], should be a subset
	}

	constructor(tw: TermCollectionTWQual, opts: TwOpts) {
		super(tw, opts)
		this.term = tw.term
		this.q = tw.q
	}

	getMinCopy() {
		const copy: any = { term: {}, q: structuredClone(this.q) }
		if (this.$id) copy.$id = this.$id
		copy.term.type = this.term.type
		copy.term.name = this.term.name
		if (this.term.id) copy.term.id = this.term.id
		if ((this.term as any).collectionId) copy.term.collectionId = (this.term as any).collectionId
		copy.term.memberType = this.term.memberType
		if (this.term.categoryKeys) copy.term.categoryKeys = structuredClone(this.term.categoryKeys)
		if (this.term.propsByTermId) copy.term.propsByTermId = structuredClone(this.term.propsByTermId)
		copy.term.termIds = this.term.termlst?.map((t: any) => t.id) || []
		if (copy.q) {
			delete copy.q.isAtomic
		}
		return copy
	}
}
