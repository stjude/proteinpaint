//import GdcFilter0 from './filter.gdc'
import { Filter } from '../filter.ts'

export type TermdbTopVariablyExpressedGenesRequest = {
	/** Ref genome */
	genome: string
	/** Ds label */
	dslabel: string
	/** Number of top genes requested */
	maxGenes: number
	geneSet?: string[]
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
}
