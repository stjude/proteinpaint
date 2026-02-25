import type { RawSingleCellGeneExpressionTerm, SingleCellGeneExpressionTerm } from '#types'

const termType = 'singleCellGeneExpression'

export class SingleCellGeneExpressionBase {
	type = termType
	gene: string
	sample: string

	static fill(term: RawSingleCellGeneExpressionTerm) {
		if (term instanceof SingleCellGeneExpressionBase) return
		SingleCellGeneExpressionBase.validate(term)
	}

	static validate(term: RawSingleCellGeneExpressionTerm) {
		if (typeof term !== 'object') throw 'term is not an object'
		if (term.type != termType) throw `incorrect term.type='${term?.type}', expecting '${termType}'`
		if (!term.gene) throw 'missing gene name'
		if (!term.sample) throw 'missing sample name'
	}

	constructor(term: RawSingleCellGeneExpressionTerm | SingleCellGeneExpressionTerm) {
		SingleCellGeneExpressionBase.validate(term)
		this.gene = term.gene
		this.sample = term.sample
	}
}
