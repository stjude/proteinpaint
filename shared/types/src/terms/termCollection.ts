import type { BaseTerm, BaseTW, MinBaseQ } from '../index.ts'

/*
For term type 'termCollection'
*/
export type CategoryKey = { key: string; shown: boolean }

type BaseTermCollection = BaseTerm & {
	name: string
	collectionId?: string
	type: 'termCollection'
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
	categoryKeys: CategoryKey[]
}

export type TermCollection = NumericTermCollection | CategoricalTermCollection

/** Pre-fill shape for a numeric termCollection (memberType set by TermCollection.fill()) */
export type RawNumericTermCollection = {
	type?: 'termCollection'
	memberType?: 'numeric'
	name?: string
	collectionId?: string
	termIds?: string[]
	termlst?: BaseTerm[]
	propsByTermId?: {
		[termId: string]: {
			[prop: string]: any
		}
	}
	numerators?: string[]
}

/** Pre-fill shape for a categorical termCollection (memberType set by TermCollection.fill()) */
export type RawCategoricalTermCollection = {
	type?: 'termCollection'
	memberType?: 'categorical'
	name?: string
	collectionId?: string
	termIds?: string[]
	termlst?: BaseTerm[]
	propsByTermId?: {
		[termId: string]: {
			[prop: string]: any
		}
	}
	categoryKeys?: CategoryKey[]
}

export type RawTermCollection = RawNumericTermCollection | RawCategoricalTermCollection

/** Q shape for numeric (continuous) termCollection wrappers */
export type TermCollectionQCont = MinBaseQ & {
	mode: 'continuous'
	type: 'values'
	/** a selection of term.ids for the current termwrapper, selected from term.lst */
	lst: string[]
	/** the sum of numerator values divided by the sum of all values will be used
	 * to sort matrix sample columns */
	numerators?: string[]
}

/** Q shape for categorical (qualitative) termCollection wrappers */
export type TermCollectionQQual = MinBaseQ & {
	mode: 'discrete'
	type: 'values'
	/** a selection of term.ids for the current termwrapper, selected from term.lst */
	lst: string[]
	categoryKeys?: CategoryKey[]
}

// TODO: may add different q types below
export type TermCollectionQ = TermCollectionQCont | TermCollectionQQual

export type TermCollectionTWCont = BaseTW & {
	type: 'TermCollectionTWCont'
	term: NumericTermCollection
	q: TermCollectionQCont
}

export type TermCollectionTWQual = BaseTW & {
	type: 'TermCollectionTWQual'
	term: CategoricalTermCollection
	q: TermCollectionQQual
}

// TODO: may add different termCollection TW types here
export type TermCollectionTW = TermCollectionTWCont | TermCollectionTWQual

export type RawTermCollectionTWCont = {
	type?: 'TermCollectionTWCont'
	term: RawNumericTermCollection
	q?: TermCollectionQCont
}

export type RawTermCollectionTWQual = {
	type?: 'TermCollectionTWQual'
	term: RawCategoricalTermCollection
	q?: TermCollectionQQual
}

// TODO: may add different termCollection TW types here
export type RawTermCollectionTW = RawTermCollectionTWCont | RawTermCollectionTWQual
