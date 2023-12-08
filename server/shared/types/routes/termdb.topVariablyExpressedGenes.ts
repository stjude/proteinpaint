import { GdcFilter0 } from './gdc.maf'

export type TermdbTopVariablyExpressedGenesRequest = {
	/** Ref genome */
	genome: string
	/** Ds label */
	dslabel: string
	/** Number of top genes requested */
	maxGenes: number
	/** JSON, optional GDC cohort filter to restrict cases */
	filter0?: GdcFilter0
}

export type TermdbTopVariablyExpressedGenesResponse = {
	/** Array of gene names TODO may change element to objs */
	genes: string[]
}
