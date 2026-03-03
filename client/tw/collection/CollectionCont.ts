import { TermCollection } from './TermCollection'
import { TwBase, type TwOpts } from '../TwBase'
import type { TermCollectionTW, TermCollectionQCont, RawTermCollectionTWCont, TermCollectionTWCont } from '#types'

export type TermCollectionTransformedValue = {
	label: string
	value: number
	pre_val_sum: number
	color?: string
}

export class CollectionCont extends TwBase {
	term: TermCollection
	q: TermCollectionQCont

	static fill(tw: RawTermCollectionTWCont, opts: TwOpts = {}): TermCollectionTWCont {
		TermCollection.fill(tw.term, opts)
		// Normalize raw tw.type ('termCollection' or missing) to canonical type
		tw.type = 'TermCollectionTWCont'

		// TODO: when more termCollection types needed, should assign different q.type here.
		if (!tw.q) tw.q = { mode: 'continuous', type: 'values', lst: [] }
		else {
			if (!tw.q.mode) tw.q.mode = 'continuous'
			if (!tw.q.lst) tw.q.lst = []
		}

		//if (!tw.q.lst?.length) throw `invalid tw.q.lst[]`

		return tw as TermCollectionTWCont
		//TODO: check tw.q.lst against term.lst, should be a subset
	}

	constructor(tw: TermCollectionTWCont, opts: TwOpts) {
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

	transformData(d) {
		const termsValue: { [termId: string]: number } = d.value

		// Collect all non-zero values
		const allValues: { [label: string]: number } = {}
		for (const [label, value] of Object.entries(termsValue)) {
			if (value !== 0) {
				allValues[label] = value
			}
		}

		// Calculate total absolute sum of all values
		const absoluteSum = Object.values(allValues).reduce((total, val) => total + Math.abs(val), 0)

		// Separate positive and negative values for proper stacking
		const positiveEntries = Object.entries(allValues).filter(([, value]) => value > 0)
		const negativeEntries = Object.entries(allValues).filter(([, value]) => value < 0)
		const hasMixedValues = positiveEntries.length > 0 && negativeEntries.length > 0

		let pre_val_sum_positive = 0
		let pre_val_sum_negative = 0
		let numerators_sum = 0
		const values: TermCollectionTransformedValue[] = []

		// Process positive values
		for (const [label, value] of positiveEntries) {
			// Calculate percentage based on absolute sum of all values
			const pct = absoluteSum > 0 ? (value / absoluteSum) * 100 : 0
			if (pct && this.q.numerators?.includes(label)) {
				numerators_sum += pct
			}
			const color = this.term.propsByTermId[label]?.color
			values.push({
				label,
				value: pct,
				pre_val_sum: pre_val_sum_positive,
				color
			})
			pre_val_sum_positive += pct
		}

		// Process negative values
		for (const [label, value] of negativeEntries) {
			// Calculate percentage based on absolute sum of all values (keeps sign)
			const pct = absoluteSum > 0 ? (value / absoluteSum) * 100 : 0
			if (Math.abs(pct) && this.q.numerators?.includes(label)) {
				numerators_sum += Math.abs(pct)
			}
			const color = this.term.propsByTermId[label]?.color
			values.push({
				label,
				value: pct,
				pre_val_sum: pre_val_sum_negative,
				color
			})
			pre_val_sum_negative += pct
		}

		d.values = values
		d.numerators_sum = numerators_sum
		d.hasMixedValues = hasMixedValues
		delete d.value
	}
}
