/** General GRIN2 route
 * This route handles the GRIN2 analysis for any non-GDC data.
 * It processes the incoming data structure via PP's existing filter infrastructure
 * and returns the same structured results as GDC-GRIN2.
 * Specifically it will return a sortable table of top mutated genes and
 * a static PNG manhattan-like plot of the -log10(q-value).
 * We allow the user to customize the snvindel, CNV, and fusion filtering options.
 */

import type { RoutePayload } from './routeApi.js'

/** GRIN2 request */
export type GRIN2Request = {
	/** Genome build identifier (e.g., 'hg38', 'hg19') */
	genome: string

	/** Dataset label within the genome */
	dslabel: string

	/** Device pixel ratio for rendering */
	devicePixelRatio?: number

	/** Desired plot width in pixels (default: 1000) */
	width?: number

	/** Desired plot height in pixels (default: 400) */
	height?: number

	/** Radius of the PNG rendered dots (default: 2) */
	pngDotRadius?: number

	/** Filter from existing PP infrastructure */
	filter?: any // Filter object passed to get_samples(filter, ds)

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
		/** Number of bases to include as 5' flank around the mutation position */
		fivePrimeFlankSize?: number
		/** Number of bases to include as 3' flank around the mutation position */
		threePrimeFlankSize?: number
	}

	/** Options for filtering CNV file content */
	cnvOptions?: {
		/** Threshold for copy number loss detection */
		lossThreshold?: number // Default: -0.4
		/** Threshold for copy number gain detection */
		gainThreshold?: number // Default: 0.3
		/** Maximum segment length to include (0 = no filter) */
		maxSegLength?: number // Default: 0
		/** Hypermutator max cut off for CNVs per case */
		hyperMutator?: number // Default: 500
		/** Number of bases to include as 5' flank around the segment position */
		fivePrimeFlankSize?: number
		/** Number of bases to include as 3' flank around the segment position */
		threePrimeFlankSize?: number
	}

	/** Options for filtering fusion file content */
	fusionOptions?: {
		/** Number of bases to include as 5' flank around the fusion position */
		fivePrimeFlankSize?: number
		/** Number of bases to include as 3' flank around the fusion position */
		threePrimeFlankSize?: number
	}

	/** Options for filtering structural variant file content */
	svOptions?: {
		/** Number of bases to include as 5' flank around the sv position */
		fivePrimeFlankSize?: number
		/** Number of bases to include as 3' flank around the sv position */
		threePrimeFlankSize?: number
	}
	maxGenesToShow?: number // Default: 500
}

/** Simple Interface to store the complex plot data from the rust Manhattan plot */
interface grin2PlotData {
	points: Array<{
		x: number // X-axis position (base pair/genomic position)
		y: number // Y-axis position (-log10(q-value))
		color: string // Point color (hexadecimal string representing a color for mutation type)
		type: string // Mutation type (e.g., 'mutation', 'loss', 'gain', 'fusion', 'sv')
		gene: string // Gene symbol
		chrom: string // Chromosome in the form of <chrX>
		start: number // Starting position of this chromosome in base pairs/genomic coordinates. Used in hover table
		end: number // Ending position of this chromosome in base pairs/genomic coordinates
		pos: number // Mid-point of this chromosome in base pairs/genomic coordinates
		q_value: number // -log10(q-value)
		nsubj: number // Number of subjects with this mutation. Used for hover table subject count
	}>
	chrom_data: Record<
		string,
		{
			start: number
			size: number
			center: number
		}
	>
	y_axis_scaled: boolean
	scale_factor: number
	total_genome_length: number
	plot_width: number
	plot_height: number
	device_pixel_ratio: number
	dpi: number
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
	/** Plot data for the Manhattan plot */
	plotData?: grin2PlotData
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
		totalSamples?: number
		processedSamples?: number
		failedSamples?: number
		failedFiles?: Array<{
			sampleName: string
			filePath: string
			error: string
		}>
		totalLesions?: number
		processedLesions?: number
		unprocessedSamples?: number
		lesionCounts?: {
			total?: number
			byType?: Record<
				string, // Our key is the GRIN2 lesion type
				{
					count: number
					capped: boolean
					samples: number
				}
			>
		}
	}
	/** Cache file name for storing GRIN2 results */
	cacheFileName?: string
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
