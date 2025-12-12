import type {
	RawTermCollection,
	TermCollection as TermCollectionType,
	TermCollectionQValues,
	TermCollectionTW,
	RawTermCollectionTWValues
} from '#types'
import { type TwOpts, TwBase } from './TwBase'

const termType = 'termCollection'

export class TermCollection {
	type = termType
	id: string
	name: string
	lst?: string[]

	// option to fill-in/mutate the input raw term object in-place
	// - does not have to construct, but may require forced type casting in consumer code
	static fill(term: RawTermCollection, opts: TwOpts = {}) {
		if (term instanceof TermCollection) return
		if (!term.lst && opts.vocabApi) {
			const collection = opts.vocabApi.termdbConfig.numericCollection[term.id || term.name]
			if (!collection) throw `missing termCollection term.lst and termdbConfig.numericTermCollection[term.id]`
			term.lst = collection.termIds
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
		this.lst = term.lst
	}
}

export class TermCollectionValues extends TwBase {
	term: TermCollection
	q: TermCollectionQValues

	static fill(tw: RawTermCollectionTWValues, opts: TwOpts = {}) {
		TermCollection.fill(tw.term, opts)
		if (!tw.q.lst?.length) throw `invalid tw.q.lst[]`
		return tw
		//TODO: check tw.q.lst against term.lst, should be a subset
	}

	constructor(tw: TermCollectionTW, opts: TwOpts) {
		super(tw, opts)
		this.term = tw.term
		this.q = tw.q
	}
}
