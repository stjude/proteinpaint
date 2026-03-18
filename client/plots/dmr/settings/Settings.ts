export type DMRSettings = {
	/** Width argument for the block (default: 800) */
	blockWidth: number
	/** Height of the GP Model track in pixels (default: 150) */
	trackHeight: number
	/** Base pairs to extend beyond the start and stop coordinates when querying for DMRs (default: 2000) */
	pad: number
	/** Base pairs flanking each CpG island used to derive Shore annotations (default: 2000) */
	shoreSize: number
	/** Maximum fraction of NaN values allowed per sample before that sample is dropped (default: 0.5) */
	nanThreshold: number
	/** Resolution of the GP Model track PNG in dots per inch (default: 100) */
	trackDpi: number
	/** Padding above and below the 0–1 beta value range on the y-axis (default: 0.1) */
	trackYPad: number
	/** Colors for the GP Model track PNG and legend */
	colors: { group1: string; group2: string; hyper: string; hypo: string }
	/** Colors for regulatory annotation types in the cCRE track */
	annotationColors: Record<string, string>
}
