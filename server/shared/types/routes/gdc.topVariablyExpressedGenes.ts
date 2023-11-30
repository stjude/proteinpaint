import { GdcFilter0 } from './gdc.maf'

export type GdcTopVariablyExpressedGenesResponse = {
	/** Array of gene names TODO may change element to objs */
	genes: string[]
}

export type GdcTopVariablyExpressedGenesRequest = {
	/** Number of top genes requested */
	maxGenes: number
	/** JSON, optional GDC cohort filter to restrict cases; if supplied, will only get maf files for these cases. the filter is readonly and pass to GDC API query */
	filter0?: GdcFilter0
}
