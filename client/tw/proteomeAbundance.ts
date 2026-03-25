import type { RawProteomeAbundanceTerm, PresetNumericBins } from '#types'

const termType = 'proteomeAbundance'

export class ProteomeAbundanceBase {
	type = termType
	protein: string
	name: string
	unit: string
	bins?: PresetNumericBins

	// option to fill-in/mutate the input raw term object in-place
	// - does not have to construct, but may require forced type casting in consumer code
	static async fill(term: RawProteomeAbundanceTerm) {
		ProteomeAbundanceBase.validate(term)
		if (!term.protein) term.protein = term.name
		else if (!term.name) term.name = term.protein
	}

	static validate(term: RawProteomeAbundanceTerm) {
		if (term.type != 'proteomeAbundance') throw 'unexpected term.type'
		if (typeof term !== 'object') throw 'term is not an object'
		if (!term.name && !term.protein) throw `missing both term.name and protein`
	}

	// option to construct an object instance and not mutate the input raw term
	// - will be used instead of term literal object
	constructor(term: RawProteomeAbundanceTerm) {
		ProteomeAbundanceBase.validate(term)
		this.protein = term.protein || term.name
		this.name = term.name || term.protein
		this.unit = term.unit || ''
		if (term.bins) this.bins = term.bins
	}
}
