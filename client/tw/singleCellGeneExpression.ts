import type { RawSingleCellGeneExpTerm, SingleCellGeneExpressionTerm, ScgeGene } from '#types'
import type { TwOpts } from './TwBase.ts'
import { SINGLECELL_GENE_EXPRESSION } from '#shared/terms.js'

const termType = SINGLECELL_GENE_EXPRESSION

export class SingleCellGeneExpressionBase {
	type = termType
	genes: any
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
		if (!term || typeof term !== 'object') throw new Error('term is not an object')
		if (term.type != termType) throw new Error(`incorrect term.type='${term?.type}', expecting '${termType}'`)
		if (!term.gene && !term.name) throw new Error('no gene or name present')
		if (!term.gene && !term.genes) throw new Error(`${termType} term must have either gene or genes property`)
		if (term.gene && typeof term.gene != 'string') throw new Error(`${termType} term.gene must be non-empty string`)
		if (term.genes && !Array.isArray(term.genes)) throw new Error(`${termType} term.genes must be an array`)
		if (!term.sample) throw new Error('missing sample')
	}

	constructor(term: RawSingleCellGeneExpTerm | SingleCellGeneExpressionTerm, opts: TwOpts) {
		SingleCellGeneExpressionBase.validate(term)
		this.genes = term.gene ? [term.gene] : (term.genes as ScgeGene[])
		this.sample = term.sample
		this.unit = term.unit || getSCGEunit(opts.vocabApi)
	}
}

export function getSCGEunit(vocabApi) {
	return vocabApi.termdbConfig.queries.singleCell.geneExpression?.unit || 'Gene Expression'
}
