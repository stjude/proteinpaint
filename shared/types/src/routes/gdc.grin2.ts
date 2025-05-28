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
	}

	/** Options for CNV file retrieval. Presence indicates CNV files should be returned (for future use) */
	cnvOptions?: any

	/** Options for fusion file retrieval. Presence indicates fusion files should be returned (for future use) */
	fusionOptions?: any
}

/**
 * Response for GRIN2 file listing
 */
export type GdcGRIN2listResponse = {
	/** List of file objects passing filter and to be displayed on client */
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

/**
 * Parameters for running GRIN2 analysis
 */

export type RunGRIN2Request = {
	/**  Case files to analyze - maps case ID to file information */
	caseFiles: {
		[caseId: string]: {
			maf?: string
		}
	}
	/**  Options for filtering MAF file content */
	mafOptions?: {
		/** Minimum total depth of returned MAF files */
		minTotalDepth?: number // Default: 10
		/** Minimum alternate allele count of returned MAF files */
		minAltAlleleCount?: number // Default: 2
	}
	/**  Options for CNV file retrieval (will be added later)
	 cnvOptions?: {
	 * lossThreshold?: number // Default: -0.5
	 * gainThreshold?: number // Default: 0.5
	 * segLength?: number // Default: 2000000
	 *}
	 */
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
