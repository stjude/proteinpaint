import {
	DNA_METHYLATION,
	GENE_EXPRESSION,
	PROTEOME_DAP,
	SINGLECELL_CELLTYPE,
	SINGLECELL_GENE_EXPRESSION,
	JUNCTION
} from '#types'
import { TermTypeGroups } from '#shared/terms.js'

/** Use the exports in this file as the single source truth for
 * the DA app and all child plots. */
export const DATermTypes = {
	GENE_EXPRESSION,
	SINGLECELL_CELLTYPE,
	DNA_METHYLATION,
	PROTEOME_DAP,
	SINGLECELL_GENE_EXPRESSION,
	JUNCTION
} as const

export const diffAnalysisTermTypeValues = Object.values(DATermTypes)
export const enabledTermTypes = new Set(diffAnalysisTermTypeValues)

export function isEnabledDiffAnalysisTermType(termType: any) {
	return enabledTermTypes.has(termType)
}

/** The kinds of data of a dataset that the two-group form (plots/DEinput.ts) runs a differential analysis
 * on, in the order it offers them. Each is gated as the form gates it: gene expression on bulk counts or
 * a pseudobulk term (pseudobulk is chosen inside the form), methylation on the promoter matrix or any
 * element class, splicing on junction clusters. */
export function getDaTermTypes(termdbConfig: any): string[] {
	const q = termdbConfig?.queries || {}
	const types: string[] = []
	if (q.rnaseqGeneCount || termdbConfig?.termType2terms?.[TermTypeGroups.PSEUDOBULK]?.length)
		types.push(GENE_EXPRESSION)
	if (q.dnaMethylation?.promoter || q.dnaMethylation?.elementTypes?.length) types.push(DNA_METHYLATION)
	if (q.junction?.cluster) types.push(JUNCTION)
	return types
}
