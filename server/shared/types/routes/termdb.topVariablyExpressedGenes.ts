//import GdcFilter0 from './filter.gdc'

export type TermdbTopVariablyExpressedGenesRequest = {
	/** Ref genome */
	genome: string
	/** Ds label */
	dslabel: string
	/** Number of top genes requested */
	maxGenes: number
	/** JSON, optional GDC cohort filter to restrict cases */
	filter0?: any //GdcFilter0
}

export type TermdbTopVariablyExpressedGenesResponse = {
	/** Array of gene names TODO may change element to objs */
	genes: string[]
}
