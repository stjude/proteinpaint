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
	id: string
	name: string
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
		if (!term.termlst && opts.vocabApi) {
			const collection = opts.vocabApi.termdbConfig.numericTermCollections.find(
				c => c.name == term.id || c.name == term.name || term.name.includes(c.name)
			)
			if (!collection) throw `missing termCollection term.lst and termdbConfig.numericTermCollection[term.id]`
			term.termlst = collection.termIds
		}

		const details = /*opts.details ||*/ opts.vocabApi?.termdbConfig?.numericTermCollections?.find(
			ntc => ntc.name === term.collectionId
		)
		if (!details) throw new Error('no matching details for ' + term.collectionId)
		if (!details.propsByTermId) throw new Error('propsByTermId missing')
		if (!term.propsByTermId) term.propsByTermId = details.propsByTermId // assign if missing
		for (const t of term.termlst) {
			if (!t.id) throw new Error('t.id missing')
			// a term newly added to term.termlst may be missing from propsByTermId and must include it
			if (!term.propsByTermId[t.id]) term.propsByTermId[t.id] = details.propsByTermId[t.id]
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
		this.termlst = term.termlst || []
		this.propsByTermId = term.propsByTermId || {}
	}
}

export class TermCollectionValues extends TwBase {
	term: TermCollection
	q: TermCollectionQValues

	static fill(tw: RawTermCollectionTWValues, opts: TwOpts = {}): TermCollectionTWValues {
		TermCollection.fill(tw.term, opts)
		//This comparison appears to be unintentional because the types '"TermCollectionValues"' and '"termCollection"' have no overlap.
		if (!tw.type || tw.type == 'termCollection') tw.type = 'TermCollectionTWValues' // only one supported tw.type for now

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
		if (tw.term) copy.term = structuredClone(tw.term)
		if (copy.q) {
			delete copy.q.isAtomic
		}
		return copy
	}

	transformData(d) {
		const termsValue: { [termId: string]: number } = d.value
		
		// Separate positive and negative values
		const positiveValues: { [label: string]: number } = {}
		const negativeValues: { [label: string]: number } = {}
		let hasPositive = false
		let hasNegative = false
		
		for (const [label, value] of Object.entries(termsValue)) {
			if (value > 0) {
				positiveValues[label] = value
				hasPositive = true
			} else if (value < 0) {
				negativeValues[label] = value
				hasNegative = true
			}
		}
		
		// Determine if we have mixed positive/negative data
		const hasMixedValues = hasPositive && hasNegative
		
		// Calculate sums
		const positiveSum = Object.values(positiveValues).reduce((total, val) => total + val, 0)
		const negativeSum = Math.abs(Object.values(negativeValues).reduce((total, val) => total + val, 0))
		
		let pre_val_sum_positive = 0
		let pre_val_sum_negative = 0
		let numerators_sum = 0
		const values: TermCollectionTransformedValue[] = []
		
		// Process positive values (0 to 100 percentage)
		for (const [label, value] of Object.entries(positiveValues)) {
			const pct = positiveSum > 0 ? (value / positiveSum) * 100 : 0
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
		
		// Process negative values (0 to -100 percentage)
		for (const [label, value] of Object.entries(negativeValues)) {
			const pct = negativeSum > 0 ? (Math.abs(value) / negativeSum) * -100 : 0
			if (pct && this.q.numerators?.includes(label)) {
				numerators_sum += pct
			}
			const color = this.term.propsByTermId[label]?.color
			values.push({
				label,
				value: pct,
				pre_val_sum: pre_val_sum_negative,
				color
			})
			pre_val_sum_negative += Math.abs(pct)
		}
		
		d.values = values
		d.numerators_sum = numerators_sum
		d.hasMixedValues = hasMixedValues
		delete d.value
	}
}
