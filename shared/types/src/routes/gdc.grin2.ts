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

enum ExperimentalStrategy {
	wxs = 'WXS'
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
		/** Minimum total depth for filtering */
		minTotalDepth?: number
		/** Minimum alternate allele count for filtering */
		minAltAlleleCount?: number
		/** Array of consequence types to include  */
		consequences?: string[]
		/** Maximum mutation count cutoff for highly mutated scenarios */
		hyperMutator?: number
		/** Optional array of project IDs to filter by (e.g., ["TCGA-GBM"]) */
		projectIds?: string[]
	}

	/** Options for CNV file retrieval. Presence indicates CNV files should be returned */
	cnvOptions?: {
		/** Data type for CNV analysis */
		dataType?: string
		/** Threshold for copy number loss detection */
		lossThreshold?: number
		/** Threshold for copy number gain detection */
		gainThreshold?: number
		/** Maximum segment length to include (0 = no filter) */
		segLength?: number
		/** Optional array of project IDs to filter by (e.g., ["TCGA-BRCA", "TCGA-LUAD"]) */
		projectIds?: string[]
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
		/** to add additional stats on cnv file listing */
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
	}
	/**  Options for filtering CNV file content*/
	cnvOptions?: {
		lossThreshold?: number // Default: -0.4
		gainThreshold?: number // Default: 0.3
		segLength?: number // Default: 0
	}
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
	total_files: number
	successful_files: number
	failed_files: number
}

/** Structured output from Rust GRIN2 processing */
export type RustGRIN2Result = {
	/** Array of successful file data arrays */
	successful_data: string[][]
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
	/** Data from Rust for making the failed files div */
	rustResult?: RustGRIN2Result
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
