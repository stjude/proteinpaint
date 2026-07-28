import type { TermCollectionQFraction } from '#types'

type CollectionMemberLike = {
	id?: string
	name?: string
	type?: string
}

export type CollectionTermLike = {
	termlst: CollectionMemberLike[]
	/** numerator/denominator member ids of a filter tvs, mirroring q.numerators[]/q.denominators[]
	of a fraction tw. only used by validateTermCollectionTvs() */
	numerators?: string[]
	denominators?: string[]
}

/** Validate the term obj of a termCollection, shared by the fraction tw and the filter tvs.
Returns the set of member term ids, for validating id arrays e.g. numerators. */
export function validateTermCollectionTerm(term: CollectionTermLike): Set<string> {
	if (!Array.isArray(term?.termlst) || !term.termlst.length)
		throw new Error('termCollection requires nonempty term.termlst[]')
	const memberIds: Set<string> = new Set()
	const types: Set<string> = new Set() // term types of member terms
	for (const t of term.termlst) {
		if (typeof t.id != 'string' || !t.id) throw new Error('member term id not non-empty string') // id required for validating id arrays e.g. numerators
		if (typeof t.type != 'string' || !t.type) throw new Error('member term type not non-empty string')
		if (memberIds.has(t.id)) throw new Error(`duplicate member term id '${t.id}'`)
		memberIds.add(t.id)

		// allow integer/float to be mixed in one collection
		types.add(t.type == 'integer' || t.type == 'float' ? 'numDict' : t.type)
	}
	if (types.size > 1) throw new Error('termCollection.termlst[] not allowed to mix multiple term types')
	return memberIds
}

/** Validate the numerator/denominator member selection of a fraction, shared by the q{} of a
fraction tw and the term of a filter tvs. Both lists are member term ids of the collection.
memberIds is returned by validateTermCollectionTerm() */
export function validateFractionMembers(numerators: string[], denominators: string[], memberIds: Set<string>): void {
	if (!Array.isArray(denominators) || !denominators.length) throw new Error('fraction requires nonempty denominators[]')
	if (!Array.isArray(numerators) || !numerators.length) throw new Error('fraction requires nonempty numerators[]')
	if (new Set(denominators).size !== denominators.length) throw new Error('fraction denominators[] contains duplicates')
	if (new Set(numerators).size !== numerators.length) throw new Error('fraction numerators[] contains duplicates')
	for (const id of denominators) {
		if (typeof id != 'string' || !id) throw new Error('fraction denominator id not non-empty string')
		if (!memberIds.has(id)) throw new Error(`fraction denominator '${id}' is not a collection member`)
	}
	for (const id of numerators) {
		if (typeof id != 'string' || !id) throw new Error('fraction numerator id not non-empty string')
		// no need to test against memberIds: denominators[] is already a subset of it
		if (!denominators.includes(id)) throw new Error(`fraction numerator '${id}' is not included in denominators[]`)
	}
}

/** tw.type of a termCollection that resolves to one numeric value per sample, the fraction
of the numerator members over the denominator ones */
export const FRACTION_TW_TYPE = 'TermCollectionTWFraction'

/** True when a tw is a fraction termCollection */
export function isFractionTw(tw: any): boolean {
	return tw?.type === FRACTION_TW_TYPE && tw?.term?.type === 'termCollection'
}

/** Build the tvs.term for filtering on a fraction termCollection, e.g. from a clicked bar
or a brushed violin. The member selection of a tw lives in q{}, but a tvs is standalone:
the server filter and the filter ui both read numerators[]/denominators[] from tvs.term.
Returns a copy, so that editing the filter later does not mutate the plot term.
@param tw a filled fraction termCollection tw
@throws Error if the tw or its member selection is invalid */
export function getFractionTvsTerm(tw: any): CollectionTermLike {
	if (!isFractionTw(tw)) throw new Error('not a fraction termCollection tw')
	const term = structuredClone(tw.term)
	// a min copy tw may carry termIds[] instead of the full termlst[]
	const memberIds = term.termlst?.length ? validateTermCollectionTerm(term) : new Set<string>(term.termIds || [])
	const denominators = tw.q?.denominators?.length ? [...tw.q.denominators] : [...memberIds]
	const numerators = tw.q?.numerators?.length ? [...tw.q.numerators] : [...denominators]
	validateFractionMembers(numerators, denominators, memberIds)
	term.numerators = numerators
	term.denominators = denominators
	return term
}

/** Validate the member selection and binning discriminator for a fraction term collection. */
export function validateTermCollectionFraction(q: TermCollectionQFraction, term: CollectionTermLike): void {
	const memberIds = validateTermCollectionTerm(term)
	validateFractionMembers(q?.numerators, q?.denominators, memberIds)
	if (q.mode === 'discrete' && q.type !== 'regular-bin' && q.type !== 'custom-bin')
		throw new Error('discrete fraction termCollection requires regular-bin or custom-bin q.type')
}
