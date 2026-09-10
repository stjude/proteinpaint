import { type RawSingleCellGeneExpTerm, type SingleCellGeneExpressionTerm, SINGLECELL_GENE_EXPRESSION } from '#types'
import type { TwOpts } from './TwBase.ts'

const termType = SINGLECELL_GENE_EXPRESSION

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
		if (!term || typeof term !== 'object') throw new Error('term is not an object')
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

/** A single-cell sample's declared assay type and, when panel-based, its
 assayed gene list. Gene search boxes offer/validate exactly those genes for
 a panel sample (the genome gene db may not contain them); a
 whole-transcriptome sample answers no genes and search stays on the genome
 gene db. A failed request answers {} (genome-db fallback). */
export async function getSampleAssayInfo(
	vocabApi: any,
	sample: { sID: string; eID?: string } | undefined
): Promise<{ assay?: 'panel' | 'wholeTranscriptome'; genes?: string[] }> {
	if (!sample?.sID) return {}
	try {
		const { dofetch3 } = await import('#common/dofetch') // avoid a static server-bundle dependency
		const v = vocabApi.vocab // genome + dslabel
		const r: any = await dofetch3('termdb/singlecellData', {
			body: {
				genome: v.genome,
				dslabel: v.dslabel,
				sample: { sID: sample.sID, eID: sample.eID },
				plots: [],
				listGenes: true
			}
		})
		// the server sends genes only for a panel-based sample
		if (r?.assay) return { assay: r.assay, genes: Array.isArray(r.genes) ? r.genes : undefined }
	} catch (e) {
		console.warn('failed to list the sample genes, falling back to the genome gene db', e)
	}
	return {}
}
