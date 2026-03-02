import type { BaseTerm, BaseTW, MinBaseQ } from '../index.ts'

/*
For term type 'snp'
*/

type BaseTermCollection = BaseTerm & {
	name: string
	collectionId?: string
	type: 'termCollection'
	/**
	 * Copies ds.cohort.termdb.termCollections[].type ('numeric' | 'categorical').
	 * Allows client code using the term to know the collection kind without looking up config.
	 */
	/** list of term.ids that are available in this collection. this is used in request payload and server side */
	termIds?: string[]
	/** list of term objs corresponding to termIds[]. 
	this is generated on server init, and sent to client, so client has easy access to show name of every term */
	termlst: BaseTerm[]
	/** TODO purpose */
	newTvs?: boolean
	propsByTermId: {
		[termId: string]: {
			[prop: string]: any
		}
	}
}

export type NumericTermCollection = BaseTermCollection & {
	/**
	 * Copies ds.cohort.termdb.termCollections[].type ('numeric' | 'categorical').
	 * Allows client code using the term to know the collection kind without looking up config.
	 */
	memberType: 'numeric'
	/** the sum of numerator values will be divided by the sum of values for all terms,
	 *  to be used for sorting matrix sample columns */
	numerators?: string[]
}

export type CategoricalTermCollection = BaseTermCollection & {
	/**
	 * Copies ds.cohort.termdb.termCollections[].type ('numeric' | 'categorical').
	 * Allows client code using the term to know the collection kind without looking up config.
	 */
	memberType: 'categorical'
	/** the sum of numerator values will be divided by the sum of values for all terms,
	 *  to be used for sorting matrix sample columns */
	categoryKeys: string[]
}

export type TermCollection = NumericTermCollection | CategoricalTermCollection

export type RawTermCollection = TermCollection & {
	type?: 'termCollection'
	termlst: BaseTerm[]
	termIds?: string[]
	propsByTermId?: {
		[termId: string]: {
			[prop: string]: any
		}
	}
}

export type TermCollectionQValues = MinBaseQ & {
	mode: 'continuous' // | 'discrete'
	type: 'values'
	// groupValuesBy: 'sampleId' | 'termId'
	/** a selection of term.ids for the current termwrapper, selected from term.lst */
	lst: string[]
	numerators?: string[]
}

// TODO: may add different q types below
export type TermCollectionQ = TermCollectionQValues

export type TermCollectionTWValues = BaseTW & {
	type: 'TermCollectionTWValues'
	term: TermCollection
	q: TermCollectionQValues
}

// TODO: may add different termCollection TW types here
export type TermCollectionTW = TermCollectionTWValues

export type RawTermCollectionTWValues = /*TermCollectionTW &*/ {
	type?: 'TermCollectionTWValues' | 'termCollection' // deprecated
	term: RawTermCollection
	q: TermCollectionQValues
}

// TODO: may add different termCollection TW types here
export type RawTermCollectionTW = RawTermCollectionTWValues
