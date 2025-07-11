/** General GRIN2 route
 * This route handles the GRIN2 analysis for any non-GDC data.
 * It processes the incoming data structure via PP's existing filter infrastructure
 * and returns the same structured results as GDC-GRIN2.
 * Specifically it will return a sortable table of top mutated genes and
 * a static PNG manhattan-like plot of the -log10(q-value).
 * We allow the user to customize the MAF, CNV, and fusion filtering options.
 */

import type { RoutePayload } from './routeApi.js'

/** GRIN2 request */
export type GRIN2Request = {
	/** Genome build identifier (e.g., 'hg38', 'hg19') */
	genome: string

	/** Dataset label within the genome */
	dslabel: string

	/** Filter from existing PP infrastructure */
	filter: any // Filter object passed to get_samples(filter, ds)

	/** Options for filtering SNV/indel file content */
	snvindelOptions?: {
		/** Minimum total depth of returned SNV/indel files */
		minTotalDepth?: number // Default: 10
		/** Minimum alternate allele count of returned SNV/indel files */
		minAltAlleleCount?: number // Default: 2
		/** String array of consequence types to include */
		consequences?: string[]
		/** Maximum mutation count cutoff for highly mutated scenarios */
		hyperMutator?: number // Default: 1000
		/** DNA assay type (e.g., 'wxs', 'wgs') */
		dnaAssay?: string // Default: 'wxs'
	}

	/** Options for filtering CNV file content */
	cnvOptions?: {
		/** Threshold for copy number loss detection */
		lossThreshold?: number // Default: -0.4
		/** Threshold for copy number gain detection */
		gainThreshold?: number // Default: 0.3
		/** Maximum segment length to include (0 = no filter) */
		maxSegLength?: number // Default: 0
		/** Minimum segment length to include (0 = no filter) */
		minSegLength?: number // Default: 0
		/** Hypermutator max cut off for CNVs per case */
		hyperMutator?: number // Default: 500
		/** DNA assay type (e.g., 'wxs', 'wgs') */
		dnaAssay?: string // Default: 'wxs'
	}

	/** Options for filtering fusion file content */
	fusionOptions?: {
		/** Filter by fusion type */
		fusionTypes?: ('gene-gene' | 'gene-intergenic' | 'readthrough')[]
		/** Minimum confidence score (0-1) */
		minConfidence?: number // Default: 0.7
		/** DNA assay type (e.g., 'wxs', 'wgs') */
		dnaAssay?: string // Default: 'wxs'
	}
}

/**
 * Response for GRIN2 analysis run
 */
export type GRIN2Response = {
	/** Status of the analysis */
	status: 'success' | 'error'
	/** Error message if status is 'error' */
	error?: string
	/** Base64-encoded PNG Manhattan plot image */
	pngImg?: string
	/** Download status/info */
	download?: any
	/** Sortable table of top genes identified by GRIN2 */
	topGeneTable?: {
		/** Column definitions with labels and sort capabilities */
		columns: Array<{
			label: string
			sortable: boolean
		}>
		/** Data rows with gene information and statistics */
		rows: Array<
			Array<{
				value: string | number
			}>
		>
	}
	/** Summary statistics */
	totalGenes?: number
	showingTop?: number
	/** Timing info for the analysis */
	timing?: {
		/** Time taken to run data processing */
		processingTime: number
		/** Time taken to run GRIN2 processing */
		grin2Time: number
		/** Total time taken for the entire run */
		totalTime: number
	}
	/** Detailed processing summary */
	processingSummary?: {
		totalSamples: number
		successfulSamples: number
		failedSamples: number
		failedFiles: Array<{
			sampleName: string
			filePath: string
			error: string
		}>
	}
}

/**
 * Route payload definitions for type checking
 */
export const GRIN2Payload: RoutePayload = {
	request: {
		typeId: 'GRIN2Request'
	},
	response: {
		typeId: 'GRIN2Response'
	}
}
