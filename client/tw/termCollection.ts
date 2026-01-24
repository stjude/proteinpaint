import type {
	RawTermCollection,
	TermCollection as TermCollectionType,
	TermCollectionQValues,
	TermCollectionTW,
	RawTermCollectionTWValues,
	TermCollectionTWValues
} from '#types'
import { type TwOpts, TwBase } from './TwBase'

const termType = 'termCollection'

export class TermCollection {
	type = termType
	id: string
	name: string
	termlst: string[]
	propsByTermId: {
		[termId: string]: {
			[prop: string]: any
		}
	}

	// option to fill-in/mutate the input raw term object in-place
	// - does not have to construct, but may require forced type casting in consumer code
	static fill(term: RawTermCollection, opts: TwOpts = {}) {
		if (term instanceof TermCollection) return
		if (term.termlst && !term.lst) {
			term.lst = term.termlst
			//delete term.termlst
		}
		if (!term.lst && opts.vocabApi) {
			const collection = opts.vocabApi.termdbConfig.numericTermCollections.find(
				c => c.name == term.id || c.name == term.name || term.name.includes(c.name)
			)
			if (!collection) throw `missing termCollection term.lst and termdbConfig.numericTermCollection[term.id]`
			term.lst = collection.termIds
		}
		if (!term.propsByTermId) {
			const details = /*opts.details ||*/ opts.vocabApi?.termdbConfig?.numericTermCollections?.find(ntc =>
				term.name.includes(ntc.name)
			)
			console.log(39, details, term.name)
			if (details?.propsByTermId) term.propsByTermId = details.propsByTermId
			console.log(40, term.propsByTermId)
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
		this.termlst = term.lst || term.termlst || []
		this.propsByTermId = term.propsByTermId
		console.log(58, this)
	}
}

export class TermCollectionValues extends TwBase {
	term: TermCollection
	q: TermCollectionQValues

	static fill(tw: RawTermCollectionTWValues, opts: TwOpts = {}): TermCollectionTWValues {
		TermCollection.fill(tw.term, opts)
		console.log(67, tw.term)
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
		console.log(86, this.term)
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
		const termsValue: any[] = d.value
		const sum = termsValue.reduce((a, o) => a + Object.values(o)[0], 0)
		let pre_val_sum = 0
		let numerators_sum = 0
		const values: any[] = []
		for (const obj of Object.values(termsValue)) {
			const label = Object.keys(obj)[0]
			const abs = Object.values(obj)[0]
			const pct = (abs / sum) * 100
			if (pct && this.q.numerators?.includes(label)) {
				numerators_sum += pct
			}
			const color =
				this.term.propsByTermId[label]?.color || this.term.lst.find(t => t.id === label || t.name == label)?.color
			values.push({
				label,
				value: pct,
				pre_val_sum,
				color
			})
			pre_val_sum += pct
		}
		d.values = values
		d.numerators_sum = numerators_sum
		delete d.value
	}
}
