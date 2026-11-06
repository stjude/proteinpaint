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
	__protected__?: any
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
	  }
	| { error: string }
