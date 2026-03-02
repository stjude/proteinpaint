import type {
	RawTermCollection,
	TermCollection as TermCollectionType,
	TermCollectionQValues,
	TermCollectionTW,
	RawTermCollectionTWValues,
	TermCollectionTWValues
} from '#types'
import { type TwOpts, TwBase } from './TwBase'

export type TermCollectionTransformedValue = {
	label: string
	value: number
	pre_val_sum: number
	color?: string
}

const termType = 'termCollection'

// This is for the term, not tw
export class TermCollection {
	type = termType
	memberType: 'numeric' | 'categorical' = 'numeric'
	id: string
	name: string
	termIds?: string[]
	termlst: object[]
	propsByTermId: {
		[termId: string]: {
			[prop: string]: any
		}
	}

	// option to fill-in/mutate the input raw term object in-place
	// - does not have to construct, but may require forced type casting in consumer code
	static fill(term: RawTermCollection, opts: TwOpts = {}) {
		if (term instanceof TermCollection) return
		if (!opts.vocabApi?.termdbConfig?.termCollections)
			throw `missing vocabApi.termdbConfig.termCollections argument for fill()`
		const tc = opts.vocabApi.termdbConfig.termCollections.find(
			c => c.name == term.collectionId || c.name == term.id || c.name == term.name || term.name?.includes(c.name)
		)
		if (!tc) throw new Error(`no matching termCollection for for ${term.collectionId}`)
		if (!Array.isArray(tc.termIds)) throw new Error(`missing termCollection.termIds for '${tc.name}'`)
		if (!Array.isArray(tc.termlst)) throw new Error('missing tc.termlst[]')
		if (tc.termIds.length == 0) throw new Error('empty termIds[]')
		if (tc.termIds.length != tc.termlst.length) throw new Error('tc.termIds.length!=tc.termlst.length')
		if (!tc.propsByTermId) throw new Error(`propsByTermId missing for termCollection='${tc.name}'`)
		if (!term.propsByTermId) term.propsByTermId = tc.propsByTermId // assign if missing
		term.memberType = tc.type
		if (!term.termIds) term.termIds = term.termlst.map((t: any) => t.id)
		for (const t of term.termlst) {
			if (!term.propsByTermId[t.id]) term.propsByTermId[t.id] = tc.propsByTermId[t.id]
		}
		TermCollection.validate(term)
	}

	static validate(term: RawTermCollection | TermCollectionType) {
		if (typeof term !== 'object') throw 'term is not an object'
		if (term.type != termType) throw `incorrect term.type='${term?.type}', expecting '${termType}'`
	}

	// option to construct an object instance and not mutate the input raw term
	// - will be used instead of tw.term literal object
	constructor(term: TermCollectionType) {
		TermCollection.validate(term)
		this.id = term.id
		this.name = term.name
		this.memberType = term.memberType
		this.termlst = term.termlst
		this.termIds = term.termIds
		this.propsByTermId = term.propsByTermId || {}
	}
}

export class TermCollectionValues extends TwBase {
	term: TermCollection
	q: TermCollectionQValues

	static fill(tw: RawTermCollectionTWValues, opts: TwOpts = {}): TermCollectionTWValues {
		TermCollection.fill(tw.term, opts)
		// Normalize raw tw.type ('termCollection' or missing) to canonical type
		if (!tw.type || (tw as RawTermCollectionTWValues).type === 'termCollection') tw.type = 'TermCollectionTWValues'

		// TODO: when more termCollection types needed, should assign different q.type here.
		if (!tw.q) tw.q = { mode: 'continuous', type: 'values', lst: [] }
		else {
			if (!tw.q.mode) tw.q.mode = 'continuous'
			if (!tw.q.lst) tw.q.lst = []
		}

		//if (!tw.q.lst?.length) throw `invalid tw.q.lst[]`

		return tw as TermCollectionTWValues
		//TODO: check tw.q.lst against term.lst, should be a subset
	}

	constructor(tw: TermCollectionTW, opts: TwOpts) {
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
