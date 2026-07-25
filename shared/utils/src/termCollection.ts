import type { TermCollectionQFraction } from '#types'

type FractionCollectionTermLike = {
	termlst: Array<{
		id?: string
		name?: string
	}>
}

/** Validate the member selection and binning discriminator for a fraction term collection. */
export function validateTermCollectionFraction(q: TermCollectionQFraction, term: FractionCollectionTermLike): void {
	if (!Array.isArray(term?.termlst) || !term.termlst.length)
		throw new Error('fraction termCollection requires nonempty term.termlst[]')
	if (!Array.isArray(q?.denominators) || !q.denominators.length)
		throw new Error('fraction termCollection requires nonempty q.denominators[]')
	if (!Array.isArray(q?.numerators) || !q.numerators.length)
		throw new Error('fraction termCollection requires nonempty q.numerators[]')
	if (new Set(q.denominators).size !== q.denominators.length)
		throw new Error('fraction termCollection q.denominators[] contains duplicates')
	if (new Set(q.numerators).size !== q.numerators.length)
		throw new Error('fraction termCollection q.numerators[] contains duplicates')

	const memberIds = new Set(term.termlst.map(member => member.id || member.name).filter(Boolean))
	for (const id of q.denominators) {
		if (!memberIds.has(id)) throw new Error(`fraction denominator '${id}' is not a collection member`)
	}
	for (const id of q.numerators) {
		if (!q.denominators.includes(id)) throw new Error(`fraction numerator '${id}' is not included in q.denominators[]`)
	}
	if (q.mode === 'discrete' && q.type !== 'regular-bin' && q.type !== 'custom-bin')
		throw new Error('discrete fraction termCollection requires regular-bin or custom-bin q.type')
}
