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

/** Validate the member selection and binning discriminator for a fraction term collection. */
export function validateTermCollectionFraction(q: TermCollectionQFraction, term: CollectionTermLike): void {
	const memberIds = validateTermCollectionTerm(term)
	validateFractionMembers(q?.numerators, q?.denominators, memberIds)
	if (q.mode === 'discrete' && q.type !== 'regular-bin' && q.type !== 'custom-bin')
		throw new Error('discrete fraction termCollection requires regular-bin or custom-bin q.type')
}
