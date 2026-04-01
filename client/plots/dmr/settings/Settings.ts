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
	/** Maximum region size (bp) to display LOESS trend curves (default: 250000) */
	maxLoessRegion: number
	/** Minimum number of probes required to show LOESS confidence intervals (default: 10) */
	minProbesForCi: number
	/** Backend engine: 'rust' (default) or 'r' (DMRCate) */
	backend: 'rust' | 'r'
	/** Maximum allowed region size in base pairs for DMR analysis (default: 5 Mb).
	 *  The server also enforces a hard cap of 10 Mb as a safety net. */
	maxRegionSize: number
}
