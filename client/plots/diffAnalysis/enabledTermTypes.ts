import { DNA_METHYLATION, GENE_EXPRESSION, PROTEOME_DAP, SINGLECELL_CELLTYPE, SINGLECELL_GENE_EXPRESSION } from '#types'

/** Use the exports in this file as the single source truth for
 * the DA app and all child plots. */
export const DATermTypes = {
	GENE_EXPRESSION,
	SINGLECELL_CELLTYPE,
	DNA_METHYLATION,
	PROTEOME_DAP,
	SINGLECELL_GENE_EXPRESSION
} as const

export const diffAnalysisTermTypeValues = Object.values(DATermTypes)
export const enabledTermTypes = new Set(diffAnalysisTermTypeValues)

export function isEnabledDiffAnalysisTermType(termType: any) {
	return enabledTermTypes.has(termType)
}
