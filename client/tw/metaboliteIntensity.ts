import type { RawMetaboliteIntensityTerm, PresetNumericBins } from '#types'

const termType = 'metaboliteIntensity'

export class MetaboliteIntensityBase {
	type = termType
	metabolite: string
	name: string
	unit: string
	bins?: PresetNumericBins

	// option to fill-in/mutate the input raw term object in-place
	// - does not have to construct, but may require forced type casting in consumer code
	static async fill(term: RawMetaboliteIntensityTerm) {
		MetaboliteIntensityBase.validate(term)
		if (!term.metabolite) term.metabolite = term.name
		else if (!term.name) term.name = term.metabolite
	}

	static validate(term: RawMetaboliteIntensityTerm) {
		if (term.type != 'metaboliteIntensity') throw 'unexpected term.type'
		if (typeof term !== 'object') throw 'term is not an object'
		if (!term.name && !term.metabolite) throw `missing both term.name and metabolite`
	}

	// option to construct an object instance and not mutate the input raw term
	// - will be used instead of term literal object
	constructor(term: RawMetaboliteIntensityTerm) {
		MetaboliteIntensityBase.validate(term)
		this.metabolite = term.metabolite || term.name
		this.name = term.name || term.metabolite
		this.unit = term.unit || ''
		if (term.bins) this.bins = term.bins
	}
}
