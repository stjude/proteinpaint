export type DMRSettings = {
	/** Width argument for the block (default: 800) */
	blockWidth: number
	/** Base pairs to extend beyond the start and stop coordinates when querying for DMRs (default: 2000) */
	pad: number
	/** DMRCate lambda: Gaussian kernel bandwidth in nucleotides (default: 1000) */
	lambda: number
	/** DMRCate C: scaling factor for kernel width (default: 2) */
	C: number
	/** FDR cutoff for CpG significance (default: 0.05) */
	fdr_cutoff: number
	/** Colors for DMR and per-CpG means visualization */
	colors: { group1: string; group2: string; hyper: string; hypo: string }
	/** Backend engine: 'rust' (default) or 'r' (DMRCate) */
	backend: 'rust' | 'r'
}
