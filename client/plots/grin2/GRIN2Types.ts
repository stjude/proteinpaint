import type { Menu } from '#dom'

export interface GRIN2Dom {
	controls: any
	div: any
	error: any
	plot: any
	tip: Menu
	header?: any
}

export interface GRIN2Opts {
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
		/** Minimum segment length to include (0 = no filter) */
		minSegLength: number
		/** Hypermutator max cut off for CNVs per case */
		hyperMutator: number
	}

	/** Options for filtering fusion file content (optional) */
	fusionOptions?: {
		/** Filter by fusion type */
		fusionTypes: ('gene-gene' | 'gene-intergenic' | 'readthrough')[]
		/** Minimum confidence score (0-1) */
		minConfidence: number
	}
}
