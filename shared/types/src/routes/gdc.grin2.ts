import type { RoutePayload } from './routeApi.js'

/**
 * Represents a file from GDC API (MAF)
 */
export type GdcGRIN2File = {
	/** A string representing the file's UUID, can be accessed via https://api.gdc.cancer.gov/data/<uuid> */
	id: string
	/** A string representing a submitter ID for the case associated with this file */
	case_submitter_id: string
	/** Case UUID */
	case_uuid: string
	/** An integer as the byte size of this file, compressed */
	file_size: number
	/** Array of strings, each is 'tumor descriptor+tissue type', for all samples involved in generating the file */
	sample_types: string[]
	/** A string as the project id of the case */
	project_id: string
	/** The format of the file (MAF) */
	file_format?: 'MAF'
}

type ExperimentalStrategy = {
	wxs: 'WXS'
}

/**
 * Request parameters for GRIN2 file listing
 */
export type GdcGRIN2listRequest = {
	/** JSON, optional GDC cohort filter to restrict cases */
	filter0?: any

	/** Options for MAF file retrieval. Presence indicates MAF files should be returned */
	mafOptions?: {
		/** Name of experimental strategy to get files for */
		experimentalStrategy: ExperimentalStrategy
	}

	/** Options for CNV file retrieval. Presence indicates CNV files should be returned */
	cnvOptions?: {
		/** Data type for CNV analysis */
		dataType?: string
	}

	/** Options for fusion file retrieval. Presence indicates fusion files should be returned (for future use) */
	fusionOptions?: any
}

/**
 * Response for GRIN2 file listing
 */
export type GdcGRIN2listResponse = {
	/** all maf-related results when mafOptions is supplied */
	mafFiles?: {
		// TODO suggest to move above maf-related results under mafFiles{}
		/** list of maf files returned to client */
		files: GdcGRIN2File[]
		/** Total number of files found by API (in case bigger than files.length) */
		filesTotal: number
		/** Maximum total size of files allowed, for indicating on UI while selecting files */
		maxTotalSizeCompressed: number
		/** File counts by type */
		fileCounts?: {
			maf: number
		}
		/** Applied filters (for UI reference) */
		appliedFilters?: {
			experimentalStrategy?: ExperimentalStrategy
		}
		/** Deduplication stats */
		deduplicationStats?: {
			originalFileCount: number
			deduplicatedFileCount: number
			duplicatesRemoved: number
			caseDetails?: Array<{ caseName: string; fileCount: number; keptFileSize: number }>
			filteredFiles: Array<{ fileId: string; fileSize: number; reason: string }>
		}
	}
	/** all cnv-related results when cnvOptions is supplied */
	cnvFiles?: {
		/** list of cnv files returned to client */
		files: GdcGRIN2File[]
		/** Maximum total size of files allowed, for indicating on UI while selecting files */
		maxTotalSizeCompressed: number
	}
}

/**
 * Parameters for running GRIN2 analysis
 */

export type RunGRIN2Request = {
	/**  Case files to analyze - maps case ID to file information */
	caseFiles: {
		[caseId: string]: {
			maf?: string
			cnv?: string
		}
	}
	/**  Options for filtering MAF file content */
	mafOptions?: {
		/** Minimum total depth of returned MAF files */
		minTotalDepth?: number // Default: 10
		/** Minimum alternate allele count of returned MAF files */
		minAltAlleleCount?: number // Default: 2
		/** String array of consequence types */
		consequences?: string[]
		/** Maximum mutation count cutoff for highly mutated scenarios */
		hyperMutator?: number
	}
	/**  Options for filtering CNV file content*/
	cnvOptions?: {
		/** Threshold for copy number loss detection */
		lossThreshold?: number // Default: -0.4
		/** Threshold for copy number gain detection */
		gainThreshold?: number // Default: 0.3
		/** Maximum segment length to include (0 = no filter) */
		segLength?: number // Default: 0
		/** Hypermutator max cut off for CNVs per case */
		hyperMutator?: number // Default: 500
	}
	/** Device pixel ratio for rendering */
	devicePixelRatio?: number // 2
	/** Plot dimensions */
	plot_width?: number // 1000
	plot_height?: number // 400
	/** Radius of the PNG rendered dots */
	pngDotRadius?: number // 2
}

/** Error entry from failed file downloads */
export type RustErrorEntry = {
	case_id: string
	data_type: string
	error_type: string
	error_details: string
	attempts_made: number
}

/** Summary information from Rust processing */
export type RustSummary = {
	type: 'summary'
	total_files: number
	successful_files: number
	failed_files: number
	errors: RustErrorEntry[]
	filtered_records: number
	filtered_maf_records: number
	filtered_cnv_records: number
	included_maf_records: number
	included_cnv_records: number

	/** The complex nested structure of the per case object
	 *  Records filtered by case, with MAF and CNV statistics
	 */
	filtered_records_by_case: Record<
		string,
		{
			maf: {
				matched_consequences: Record<string, any>
				rejected_consequences: Record<string, any>
				t_alt_count: number
				t_depth: number
				invalid_rows: number
				excluded_by_min_depth: number
				excluded_by_min_alt_count: number
				excluded_by_consequence_type: number
				total_processed: number
				total_included: number
				skipped_chromosomes: Record<string, number>
			}
			cnv: {
				segment_mean: number
				seg_length: number
				invalid_rows: number
				excluded_by_loss_threshold: number
				excluded_by_gain_threshold: number
				excluded_by_segment_length: number
				total_processed: number
				total_included: number
				skipped_chromosomes: Record<string, number>
			}
		}
	>

	hyper_mutator_records: Record<string, string[]>
	excluded_by_max_record: Record<string, string[]>
}

/** Structured output from Rust GRIN2 processing */
export type RustGRIN2Result = {
	/** String of successful file data */
	successful_data: string
	/** Array of failed file information */
	failed_files: RustErrorEntry[]
	/** Summary statistics */
	summary: RustSummary
}

/**
 * Response for GRIN2 analysis run
 */
export type RunGRIN2Response = {
	/** Status of the analysis */
	status: 'success' | 'error'
	/** Error message if status is 'error' */
	error?: string
	/** Path to the generated image if status is 'success' */
	pngImg?: string
	/** Download status */
	download?: any
	/** Table of top genes indentified by analysis */
	topGeneTable?: any
	/** Data from Rust for making the analysis summary div */
	rustResult?: RustGRIN2Result
	/** Timing info from nodejs */
	timing?: {
		/** Time taken to run Rust processing */
		rustProcessingTime: number
		/** Time taken to run GRIN2 processing */
		grin2Time: number
		/** Total time taken for the entire run */
		totalTime: number
	}
}
/**
 * Route payload definitions for type checking
 */
export const gdcGRIN2listPayload: RoutePayload = {
	request: {
		typeId: 'GdcGRIN2listRequest'
	},
	response: {
		typeId: 'GdcGRIN2listResponse'
	}
}

export const runGRIN2Payload: RoutePayload = {
	request: {
		typeId: 'RunGRIN2Request'
	},
	response: {
		typeId: 'RunGRIN2Response'
	}
}
