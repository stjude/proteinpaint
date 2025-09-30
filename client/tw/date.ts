import type { RawDateTerm } from '#types'

const termType = 'date'

export class DateBase {
	type = termType

	// option to fill-in/mutate the input raw term object in-place
	// - does not have to construct, but may require forced type casting in consumer code
	static async fill(term: RawDateTerm) {
		this.validate(term)
	}

	static validate(term: RawDateTerm) {
		if (term.type != 'date') throw 'unexpected term.type'
		if (typeof term !== 'object') throw 'term is not an object'
		if (!term.name || typeof term.name != 'string') throw 'invalid date term.name'
	}

	// option to construct an object instance and not mutate the input raw term
	// - will be used instead of term literal object
	constructor(term: RawDateTerm) {
		DateBase.validate(term)
	}
}
