import type { BaseTerm, BaseTW, MinBaseQ } from '../index.ts'

/*
For term type 'snp'
*/

export type TermCollection = BaseTerm & {
	id?: string
	name: string
	type: 'termCollection'
	// may be queried from backend, but should be available in frontend for termsetting edit menu
	/** the full list of term.ids that are available in this collection */
	lst?: string[]
}

export type RawTermCollection = TermCollection & {
	type?: 'termCollection'
}

export type TermCollectionQValues = MinBaseQ & {
	mode: 'continuous' // | 'discrete'
	type: 'values'
	// groupValuesBy: 'sampleId' | 'termId'
	/** a selection of term.ids for the current termwrapper, selected from term.lst */
	lst: string[]
}

// TODO: may add different q types below
export type TermCollectionQ = TermCollectionQValues

export type TermCollectionTWValues = BaseTW & {
	type: 'TermCollectionValues'
	term: TermCollection
	q: TermCollectionQValues
}

// TODO: may add different termCollection TW types here
export type TermCollectionTW = TermCollectionTWValues

export type RawTermCollectionTWValues = /*TermCollectionTW &*/ {
	type?: 'TermCollectionValues' | 'termCollection' // deprecated
	term: RawTermCollection
	q: TermCollectionQValues
}

// TODO: may add different termCollection TW types here
export type RawTermCollectionTW = RawTermCollectionTWValues
