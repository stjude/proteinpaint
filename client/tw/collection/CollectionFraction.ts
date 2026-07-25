import { NumericTermCollection } from './NumericTermCollection'
import { TwBase, type TwOpts } from '../TwBase'
import type { RawTermCollectionTWFraction, TermCollectionQFraction, TermCollectionTWFraction } from '#types'
import { validateTermCollectionFraction } from '#shared/termCollection.js'

export class CollectionFraction extends TwBase {
	term: NumericTermCollection
	q: TermCollectionQFraction

	static fill(tw: RawTermCollectionTWFraction, opts: TwOpts = {}): TermCollectionTWFraction {
		NumericTermCollection.fill(tw.term, opts)
		if (!tw.q) throw new Error('fraction termCollection requires q')
		if (!tw.q.mode) tw.q.mode = 'continuous'
		const memberIds = tw.term.termIds?.slice() || tw.term.termlst?.map((term: any) => term.id || term.name) || []
		if (!tw.q.denominators?.length) tw.q.denominators = memberIds
		if (!tw.q.numerators?.length) tw.q.numerators = memberIds.slice()
		validateTermCollectionFraction(tw.q, tw.term as NumericTermCollection)
		const term = tw.term as any
		if (!term.bins) {
			const regular = {
				type: 'regular-bin',
				mode: 'discrete',
				bin_size: 0.25,
				first_bin: { startunbounded: true, stop: 0.25 },
				last_bin: { start: 0.75, stopunbounded: true },
				startinclusive: true
			}
			term.bins = { default: regular, less: structuredClone(regular), min: 0, max: 1 }
		}
		tw.type = 'TermCollectionTWFraction'
		return tw as TermCollectionTWFraction
	}

	constructor(tw: TermCollectionTWFraction, opts: TwOpts) {
		super(tw, opts)
		this.term = tw.term
		this.q = tw.q
	}

	getMinCopy() {
		const copy: any = { type: 'TermCollectionTWFraction', term: {}, q: structuredClone(this.q) }
		if (this.$id) copy.$id = this.$id
		copy.term.type = this.term.type
		copy.term.name = this.term.name
		if (this.term.id) copy.term.id = this.term.id
		copy.term.memberType = this.term.memberType
		if (this.term.propsByTermId) copy.term.propsByTermId = structuredClone(this.term.propsByTermId)
		copy.term.termIds = this.term.termlst?.map((term: any) => term.id || term.name) || []
		if ((this.term as any).isCustom) {
			copy.term.isCustom = true
			copy.term.termlst = structuredClone(this.term.termlst)
		}
		delete copy.q.isAtomic
		return copy
	}
}
