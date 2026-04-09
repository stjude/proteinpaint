import { NumericTermCollection } from './NumericTermCollection'
import { TwBase, type TwOpts } from '../TwBase'
import type { TermCollectionQCont, RawTermCollectionTWCont, TermCollectionTWCont } from '#types'

export type TermCollectionTransformedValue = {
	label: string
	value: number
	pre_val_sum: number
	color?: string
}

export class CollectionCont extends TwBase {
	term: NumericTermCollection
	q: TermCollectionQCont

	static fill(tw: RawTermCollectionTWCont, opts: TwOpts = {}): TermCollectionTWCont {
		NumericTermCollection.fill(tw.term, opts)
		tw.type = 'TermCollectionTWCont'

		if (!tw.q) tw.q = { mode: 'continuous', type: 'values', lst: [] }
		else {
			if (!tw.q.mode) tw.q.mode = 'continuous'
			if (!tw.q.type) tw.q.type = 'values'
			if (!tw.q.lst) tw.q.lst = []
			// Default numerators to all term IDs for old URLs that predate this field
			if (!tw.q.numerators)
				tw.q.numerators = tw.term.termIds?.slice() || tw.term.termlst?.map((t: any) => t.id || t.name) || []
		}

		return tw as TermCollectionTWCont
		//TODO: check tw.q.lst against term.termIds[], should be a subset
	}

	constructor(tw: TermCollectionTWCont, opts: TwOpts) {
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
		copy.term.memberType = this.term.memberType
		if (this.term.numerators) copy.term.numerators = structuredClone(this.term.numerators)
		if (this.term.propsByTermId) copy.term.propsByTermId = structuredClone(this.term.propsByTermId)
		if (this.term.valueTransform) copy.term.valueTransform = structuredClone(this.term.valueTransform)
		copy.term.termIds = this.term.termlst?.map((t: any) => t.id || t.name) || []
		if ((this.term as any).isCustom) {
			copy.term.isCustom = true
			copy.term.termlst = structuredClone(this.term.termlst)
		}
		if (copy.q) {
			delete copy.q.isAtomic
		}
		return copy
	}

	transformData(d: any) {
		const termsValue: { [termId: string]: number } = d.value
		// Collect all non-zero values after applying value transformation (if any)
		const allValues: { [label: string]: number } = {}
		for (const [label, value] of Object.entries(termsValue)) {
			let transformedV: number = value
			if (this.term.valueTransform) {
				const offset = (this.term.valueTransform as any).offset
				if (typeof offset === 'number') {
					transformedV += offset
				}
				// Add more transformation types here as needed
			}

			if (transformedV !== 0) {
				allValues[label] = transformedV as number
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
