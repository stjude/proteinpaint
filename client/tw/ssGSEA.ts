import type { RawSsGSEATerm, PresetNumericBins } from '#types'

const termType = 'ssGSEA'

export class SsGSEABase {
	type = termType
	id: string
	name: string
	bins?: PresetNumericBins
	unit?: string

	// option to fill-in/mutate the input raw term object in-place
	// - does not have to construct, but may require forced type casting in consumer code
	static async fill(term: RawSsGSEATerm) {
		SsGSEABase.validate(term)
		if (!term.name) term.name = term.id // only apply to native; lack way to auto retrieve
	}

	static validate(term: RawSsGSEATerm) {
		if (term.type != 'ssGSEA') throw `unexpected term.type='$term.type', should be '${termType}'`
		if (typeof term !== 'object') throw 'term is not an object'
		if (!term.id) throw 'term.id missing'
	}

	// option to construct an object instance and not mutate the input raw term
	// - will be used instead of term literal object
	constructor(term: RawSsGSEATerm) {
		SsGSEABase.validate(term)
		this.id = term.id
		this.name = term.name || term.id
		this.bins = term.bins
		this.unit = term.unit
	}
}
