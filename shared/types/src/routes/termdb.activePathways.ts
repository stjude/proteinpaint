import type { DERequest } from './termdb.DE.ts'
import type { DiffMethRequest } from './termdb.diffMeth.ts'

/** ActivePathways on two groups, see server/src/routes/termdb.activePathways.ts */
export type ActivePathwaysRequest = {
	genome: string
	dslabel: string
	/** the expression DE run, as the volcano sends it */
	deRequest: Partial<DERequest>
	/** the DMR scan, as the volcano sends it; its gene-body delta-beta is the methylation layer */
	dmRequest: Partial<DiffMethRequest>
	/** an msigdb analysisGenesetGroups value */
	geneSetGroup: string
	/** the gene-body layer's z-score is among genes of the same expression level, not among all genes */
	adjust_expression_level?: boolean
	__protected__?: any
}

/** one layer's result for one gene set, see layeredPathways in server/src/utils/directionalPathways.ts */
export type ActivePathwaysLayer = {
	/** log10 of the Benjamini-Hochberg q over the group's tested sets */
	log10q: number
	/** 1 when the genes the test picked mostly went up (gained methylation), -1 down, 0 none picked */
	direction: number
	/** genes the test picked */
	overlap: number
}

export type ActivePathwaysResponse = {
	geneSetGroup: string
	/** genes with both layers, the background */
	genes: number
	/** sets of 10-500 background genes, the number each q corrects for */
	tested: number
	/** genes at p <= 0.05: expression, gene body, merged */
	passing: [number, number, number]
	/** Brown's correction for the dependence between the two layers; df 4 and scale 1 when independent */
	brown: { df: number; scale: number }
	/** sets at q < 0.05 in some layer */
	sets: {
		id: string
		/** background genes in the set */
		size: number
		/** expression, gene body, merged */
		layers: [ActivePathwaysLayer, ActivePathwaysLayer, ActivePathwaysLayer]
		/** up to 30 of the genes the merged test picked, most significant first */
		genes: string[]
	}[]
}
