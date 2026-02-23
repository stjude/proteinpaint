import type { RawDnaMethylationTerm } from '#types'

const termType = 'dnaMethylation'

export class DnaMethylationBase {
	id: string
	name: string
	unit: string

	// option to fill-in/mutate the input raw term object in-place
	// - does not have to construct, but may require forced type casting in consumer code
	static async fill(term: RawDnaMethylationTerm) {
		DnaMethylationBase.validate(term)
		if (!term.name) {
			term.unit = 'Average Beta Value'
			const name = `${term.id} ${term.unit}`
			term.name = name
		}
	}

	static validate(term: RawDnaMethylationTerm) {
		if (typeof term !== 'object') throw 'term is not an object'
		if (term.type != termType) throw `incorrect term.type='${term?.type}', expecting '${termType}'`
		if (term.type != 'dnaMethylation') throw 'unexpected term.type'
		if (typeof term !== 'object') throw 'term is not an object'
		if (!term.id) throw 'term.id is missing'
		if (!term.chr || !Number.isInteger(term.start) || !Number.isInteger(term.stop))
			throw 'incomplete coordinate in term{}'
	}

	// option to construct an object instance and not mutate the input raw term
	// - will be used instead of term literal object
	constructor(term: RawDnaMethylationTerm) {
		DnaMethylationBase.validate(term)
		this.id = term.id
		this.unit = term.unit || 'Average Beta Value'
		this.name = term.name || `${this.id} ${this.unit}`
	}
}
