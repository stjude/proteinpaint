export type MethylationStarburstRequest = {
	genome: string
	dslabel: string
	/** the two groups as a two-group analysis sends them: group1 is the control, group2 the case */
	samplelst: { groups: any[] }
	/** each gene's Δβ as its excess over width- and CpG-matched intergenic background, see termdb/geneBodyMeth */
	corrected?: boolean
	/** leave out genes on chrX and chrY, whose methylation follows sex */
	excludeSexChr?: boolean
	/** differential expression settings, sent as the DE volcano sends them so the two share one cached run */
	method?: string
	min_count?: number
	min_total_count?: number
	cpm_cutoff?: number
	filter?: any
	filter0?: any
	/** an msigdb analysisGenesetGroups value: adds `pathways` to the response */
	geneSetGroup?: string
	__protected__?: any
}

/** one layer's result for one gene set, see server/src/utils/directionalPathways.ts layeredPathways */
export type StarburstPathwayLayer = {
	/** log10 of the Benjamini-Hochberg q over the group's tested sets */
	log10q: number
	/** 1 when the genes the test picked mostly went up (gained methylation), -1 down, 0 none picked */
	direction: number
	/** genes the test picked */
	overlap: number
}

/** Gene-set enrichment from expression, from gene-body methylation, and from the two merged per gene, on the genes
 * with both (directional P-value merging with methylation expected to move with expression, then ranked
 * hypergeometric enrichment of the genes at p <= 0.05, as ActivePathways). Expression: DE p and fold change; gene body:
 * each patient's gene-body beta centered on their median body, Welch's t-test between the groups (termdb/geneBodyMeth).
 * Only sets at q < 0.05 in some layer are listed. */
export type StarburstPathways = {
	geneSetGroup: string
	/** genes with both layers, the background */
	genes: number
	/** sets of 10-500 background genes, the number each q corrects for */
	tested: number
	/** genes at p <= 0.05: expression, gene body, merged */
	passing: [number, number, number]
	/** Brown's correction for the dependence between the two layers; df 4 and scale 1 when independent */
	brown: { df: number; scale: number }
	sets: {
		id: string
		/** background genes in the set */
		size: number
		/** expression, gene body, merged */
		layers: [StarburstPathwayLayer, StarburstPathwayLayer, StarburstPathwayLayer]
		/** up to 30 of the genes the merged test picked, most significant first */
		genes: string[]
	}[]
}

/** One entry per gene that has a fold change and a methylation value in at least one region, as parallel arrays.
 * Δβ and log2 fold change are group2 minus group1. */
export type MethylationStarburstResponse =
	| {
			genes: string[]
			log2fc: number[]
			/** DE adjusted p, or the unadjusted one where DE gave no adjusted p */
			q: number[]
			/** mean Δβ over the core promoter (default isoform TSS -2 kb to +500 bp); null when under 5 CpGs */
			promoter: (number | null)[]
			/** mean Δβ over the gene body less 2 kb at each end; null when under 5 CpGs */
			body: (number | null)[]
			sampleSize1: number
			sampleSize2: number
			deMethod?: string
			corrected: boolean
			/** with the request's geneSetGroup */
			pathways?: StarburstPathways
	  }
	| { error: string }
