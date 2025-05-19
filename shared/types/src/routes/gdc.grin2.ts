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
	/** Name of experimental strategy to get files for */
	experimentalStrategy: ExperimentalStrategy
	/** JSON, optional GDC cohort filter to restrict cases */
	filter0?: any
	/** Optional array of file types to include ('MAF') */
	fileTypes?: Array<'MAF'>
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
		fileTypes?: Array<'MAF'>
		experimentalStrategy?: ExperimentalStrategy
	}
}

/**
 * Parameters for running GRIN2 analysis
 */
export type RunGRIN2Request = {
	[caseId: string]: { maf?: string }
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
	imagestring?: string
	/** Download status */
	download?: any
	/** Table of top genes indentified by analysis */
	topgenetable?: any
}
/**
 * Route payload definitions for type checking
 */
export const gdcGRIN2Payload: RoutePayload = {
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
