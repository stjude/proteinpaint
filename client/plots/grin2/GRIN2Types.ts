import type { Menu } from '#dom'

export interface GRIN2Dom {
	controls: any
	div: any
	tip: Menu
	geneTip: Menu
	header?: any
	snvindel_minTotalDepth?: any
	snvindel_minAltAlleleCount?: any
	snvindel_consequences?: any
	snvindel_five_prime_flank_size?: any
	snvindel_three_prime_flank_size?: any
	cnv_lossThreshold?: any
	cnv_gainThreshold?: any
	cnv_maxSegLength?: any
	cnv_five_prime_flank_size?: any
	cnv_three_prime_flank_size?: any
	fusion_five_prime_flank_size?: any
	fusion_three_prime_flank_size?: any
	sv_five_prime_flank_size?: any
	sv_three_prime_flank_size?: any
}

export interface GRIN2Opts {
	/** Manhattan plot settings */
	plotWidth?: number
	plotHeight?: number
	pngDotRadius?: number
	yAxisX?: number
	yAxisY?: number
	yAxisSpace?: number
	fontSize?: number
	showLegend?: boolean
	legendItemWidth?: number
	legendDotRadius?: number
	legendRightOffset?: number
	legendTextOffset?: number
	legendVerticalOffset?: number
	legendFontSize?: number
	showInteractiveDots?: boolean
	interactiveDotRadius?: number
	interactiveDotStrokeWidth?: number
	showDownload?: boolean
	/** Override default settings */
	overrides?: Partial<GRIN2Settings>
	/** Any additional options */
	[key: string]: any
}

export interface GRIN2Settings {
	/** Options for filtering SNV/indel file content */
	snvindelOptions: {
		/** Minimum total depth of returned SNV/indel files */
		minTotalDepth: number
		/** Minimum alternate allele count of returned SNV/indel files */
		minAltAlleleCount: number
		/** String array of consequence types to include */
		consequences: string[]
		/** Maximum mutation count cutoff for highly mutated scenarios */
		hyperMutator: number
	}

	/** Options for filtering CNV file content */
	cnvOptions: {
		/** Threshold for copy number loss detection */
		lossThreshold: number
		/** Threshold for copy number gain detection */
		gainThreshold: number
		/** Maximum segment length to include (0 = no filter) */
		maxSegLength: number
		/** Hypermutator max cut off for CNVs per case */
		hyperMutator: number
	}

	/** Options for filtering fusion file content (optional). For now we won't have any options */
	fusionOptions?: {
		[key: string]: any
	}
	/** Options for filtering structural variant file content (optional). For now we won't have any options */
	svOptions?: {
		[key: string]: any
	}
	/** Options for general GRIN2 settings (optional) */
	generalOptions?: {
		[key: string]: any
	}
}
