import type { BaseTerm, BaseTW, MinBaseQ } from '../index.ts'
import type { ContinuousNumericQ, RegularNumericBinConfig, CustomNumericBinConfig } from './numeric.ts'

/*
For term type 'termCollection'
*/
export type CategoryKey = { key: string; shown: boolean }

type BaseTermCollection = BaseTerm & {
	name: string
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
	/** When true, member terms are non-dictionary terms (e.g. isoformExpression).
	 *  getData() expands them into individual tws for existing handlers, then
	 *  reconstitutes the grouped shape after data is returned. */
	isCustom?: boolean
}

export type NumericTermCollection = BaseTermCollection & {
	/**
	 * Copies ds.cohort.termdb.termCollections[].type ('numeric' | 'categorical').
	 * Allows client code using the term to know the collection kind without looking up config.
	 */
	memberType: 'numeric'
	/** the sum of numerator values will be divided by the sum of denominator values,
	 *  to be used for sorting matrix sample columns, or as the value of a filter tvs */
	numerators?: string[]
	/** term ids the numerator sum is divided by, a filter tvs uses this to reduce the
	 *  collection to a percentage. mirrors q.denominators[] of a fraction tw;
	 *  when unset, every member of term.termlst[] is a denominator */
	denominators?: string[]
	/** optional transformation. app specific
	 */
	valueTransform?: { offset?: number }
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
	termIds?: string[]
	termlst?: BaseTerm[]
	propsByTermId?: {
		[termId: string]: {
			[prop: string]: any
		}
	}
	numerators?: string[]
	isCustom?: boolean
}

/** Pre-fill shape for a categorical termCollection (memberType set by TermCollection.fill()) */
export type RawCategoricalTermCollection = {
	type?: 'termCollection'
	memberType?: 'categorical'
	name?: string
	termIds?: string[]
	termlst?: BaseTerm[]
	propsByTermId?: {
		[termId: string]: {
			[prop: string]: any
		}
	}
	categoryKeys?: CategoryKey[]
	isCustom?: boolean
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

/** Q shape for fraction termCollection wrappers. this resolves the collection to a fractional number for each sample, so the tw functions like a numeric term */
export type TermCollectionQFraction = MinBaseQ & {
	/** term ids for denominators */
	denominators: string[]
	/** term ids for numerators */
	numerators: string[]
} & (ContinuousNumericQ | RegularNumericBinConfig | CustomNumericBinConfig)

/** Q shape for categorical (qualitative) termCollection wrappers */
export type TermCollectionQQual = MinBaseQ & {
	mode: 'discrete'
	type: 'values'
	/** a selection of term.ids for the current termwrapper, selected from term.lst */
	lst: string[]
	categoryKeys?: CategoryKey[]
}

// TODO: may add different q types below
export type TermCollectionQ = TermCollectionQCont | TermCollectionQQual | TermCollectionQFraction

export type TermCollectionTWCont = BaseTW & {
	type: 'TermCollectionTWCont'
	term: NumericTermCollection
	q: TermCollectionQCont
}

export type TermCollectionTWFraction = BaseTW & {
	type: 'TermCollectionTWFraction'
	term: NumericTermCollection
	q: TermCollectionQFraction
}

export type TermCollectionTWQual = BaseTW & {
	type: 'TermCollectionTWQual'
	term: CategoricalTermCollection
	q: TermCollectionQQual
}

// TODO: may add different termCollection TW types here
export type TermCollectionTW = TermCollectionTWCont | TermCollectionTWFraction | TermCollectionTWQual

export type RawTermCollectionTWCont = BaseTW & {
	type?: 'TermCollectionTWCont'
	term: RawNumericTermCollection
	q?: TermCollectionQCont
}

export type RawTermCollectionTWFraction = BaseTW & {
	type?: 'TermCollectionTWFraction'
	term: RawNumericTermCollection
	q: TermCollectionQFraction
}

export type RawTermCollectionTWQual = BaseTW & {
	type?: 'TermCollectionTWQual'
	term: RawCategoricalTermCollection
	q?: TermCollectionQQual
}

// TODO: may add different termCollection TW types here
export type RawTermCollectionTW = RawTermCollectionTWCont | RawTermCollectionTWFraction | RawTermCollectionTWQual
