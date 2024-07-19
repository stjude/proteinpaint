//import GdcFilter0 from './filter.gdc'
import { Filter } from '../filter.ts'

export type TermdbTopVariablyExpressedGenesRequest = {
	/** Ref genome */
	genome: string
	/** Ds label */
	dslabel: string
	/** Number of top genes requested */
	maxGenes: number
	/** User defined preference to include all genes or a subset */
	geneSet?: {
		/** Indicates the geneset to return
		 * all - all genes
		 * custom - user defined list of genes
		 * msigdb - msigdb geneset
		 */
		type: 'all' | 'custom' | 'msigdb'
		/** Sent as null for 'all' types. Otherwise a list of gene symbols */
		geneList: string[] | null
	}
	/** optional parameter. used for querying gdc api, not used for non-gdc ds */
	min_median_log2_uqfpkm?: number
	/** pp filter */
	filter?: Filter
	/** JSON, optional GDC cohort filter to restrict cases */
	filter0?: any //GdcFilter0
}

export type TermdbTopVariablyExpressedGenesResponse = {
	/** Array of gene names TODO may change element to objs */
	genes: string[]
	/** Array of user inputted gene symbols not present in the returned genes */
	notFoundGenes: string[]
}
