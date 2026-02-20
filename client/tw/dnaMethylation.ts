import type { RawDnaMethylationTerm } from '#types'

const termType = 'dnaMethylation'

export class DnaMethylationBase {
	//gene: string
	//name: string
	//unit: string

	// option to fill-in/mutate the input raw term object in-place
	// - does not have to construct, but may require forced type casting in consumer code
	static async fill(term: RawDnaMethylationTerm) {
		DnaMethylationBase.validate(term)
		/*if (!term.name) {
			term.unit = opts.vocabApi.termdbConfig.queries.geneExpression?.unit || 'Gene Expression'
			const name = `${term.gene} ${term.unit}`
			term.name = name
		}*/
	}

	static validate(term: RawDnaMethylationTerm) {
		if (typeof term !== 'object') throw 'term is not an object'
		if (term.type != termType) throw `incorrect term.type='${term?.type}', expecting '${termType}'`
		if (term.type != 'dnaMethylation') throw 'unexpected term.type'
		if (typeof term !== 'object') throw 'term is not an object'
		//if (!term.gene && !term.name) throw 'no gene or name present'
		//if (!term.gene || typeof term.gene != 'string') throw 'geneExpression term.gene must be non-empty string'
	}

	// option to construct an object instance and not mutate the input raw term
	// - will be used instead of term literal object
	constructor(term: RawDnaMethylationTerm) {
		DnaMethylationBase.validate(term)
		/*this.gene = term.gene || term.name
		this.unit = term.unit || opts.vocabApi.termdbConfig.queries.geneExpression?.unit || 'Gene Expression'
		this.name = term.name || `${term.gene} ${this.unit}`*/
	}
}
