import type { RawSingleCellGeneExpTerm, SingleCellGeneExpressionTerm } from '#types'
import type { TwOpts } from './TwBase.ts'

const termType = 'singleCellGeneExpression'

export class SingleCellGeneExpressionBase {
	type = termType
	gene: string
	sample: string
	unit: string

	static fill(term: RawSingleCellGeneExpTerm, opts: TwOpts) {
		if (term instanceof SingleCellGeneExpressionBase) return
		SingleCellGeneExpressionBase.validate(term)
		if (!term.name) {
			term.unit = getSCGEunit(opts.vocabApi)
			term.name = `${term.gene} ${term.unit}`
		}
	}

	static validate(term: RawSingleCellGeneExpTerm) {
		if (typeof term !== 'object') throw new Error('term is not an object')
		if (term.type != termType) throw new Error(`incorrect term.type='${term?.type}', expecting '${termType}'`)
		if (!term.gene && !term.name) throw new Error('no gene or name present')
		if (!term.gene || typeof term.gene != 'string') throw new Error(`${termType} term.gene must be non-empty string`)
		if (!term.sample) throw new Error('missing sample name')
	}

	constructor(term: RawSingleCellGeneExpTerm | SingleCellGeneExpressionTerm, opts: TwOpts) {
		SingleCellGeneExpressionBase.validate(term)
		this.gene = term.gene
		this.sample = term.sample
		this.unit = term.unit || getSCGEunit(opts.vocabApi)
	}
}

export function getSCGEunit(vocabApi) {
	return vocabApi.termdbConfig.queries.singleCell.geneExpression?.unit || 'Gene Expression'
}
