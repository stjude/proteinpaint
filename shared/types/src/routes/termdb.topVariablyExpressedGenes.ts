//import GdcFilter0 from './filter.gdc'
import type { Filter } from '../filter.ts'
import type { ErrorResponse } from './errorResponse.ts'

export type TermdbTopVariablyExpressedGenesRequest = {
	/** Ref genome */
	genome: string
	/** Ds label */
	dslabel: string
	/** Number of top genes requested */
	maxGenes: number
	/** optional param defined by dataset. if to scan all or subset of genes */
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
	/** optional parameter defined in gdc dataset. not used for non-gdc ds */
	min_median_log2_uqfpkm?: number
	/** filter extreme values (in native implementation): true/false */
	filter_extreme_values?: boolean | number
	/** Filter type: variance/inter-quartile region (in native implementation) */
	rank_type?: {
		type: 'var' | 'iqr'
	}
	filter?: Filter
	/** JSON, optional GDC cohort filter to restrict cases */
	filter0?: any //GdcFilter0
	/** helps ds getter */
	ds?: any
}

type ValidResponse = {
	/** Array of gene names TODO may change element to objs */
	genes: string[]
}

export type TermdbTopVariablyExpressedGenesResponse = ErrorResponse | ValidResponse

// TODO: write payload examples to help with automated testing and documentation, for non-prod use only
