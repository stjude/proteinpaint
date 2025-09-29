import { type TwOpts } from './TwBase.ts'
import type { RawGeneExpTerm } from '#types'

const termType = 'geneExpression'

export class GeneExpBase {
	// option to fill-in/mutate the input raw term object in-place
	// - does not have to construct, but may require forced type casting in consumer code
	static async fill(term: RawGeneExpTerm, opts: TwOpts) {
		if (term.type != 'geneExpression') throw 'unexpected term.type'
		if (typeof term !== 'object') throw 'term is not an object'
		if (!term.gene && !term.name) throw 'no gene or name present'
		if (!term.gene) term.gene = term.name
		if (!term.gene || typeof term.gene != 'string') throw 'geneExpression term.gene must be non-empty string'

		if (!term.name) {
			const unit = opts.vocabApi.termdbConfig.queries.geneExpression?.unit || 'Gene Expression'
			const name = `${term.gene} ${unit}`
			term.name = name
		}
	}

	static validate(term: RawGeneExpTerm) {
		if (typeof term !== 'object') throw 'term is not an object'
		if (term.type != termType) throw `incorrect term.type='${term?.type}', expecting '${termType}'`
	}

	// option to construct an object instance and not mutate the input raw term
	// - will be used instead of term literal object
	constructor(term: RawGeneExpTerm) {
		GeneExpBase.validate(term)
	}
}
