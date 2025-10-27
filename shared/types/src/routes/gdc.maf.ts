import type { RoutePayload } from './routeApi.js'
//import GdcFilter0 from './filter.gdc'

// an object representing gdc maf file, to be shown on client table

export type GdcMafFile = {
	/** A string representing the file's UUID (Universally Unique Identifier) , can be accessed via https://api.gdc.cancer.gov/data/<uuid>*/
	id: string
	/** A string representing a submitter ID for the case associated with this file */
	case_submitter_id: string
	// case uuid
	case_uuid: string
	/** An integer as the byte size of this file, compressed */
	file_size: number
	/** Array of strings, each is 'tumor descriptor+tissue type', for all samples involved in generating the maf file */
	sample_types: string[]
	/** A string representing the type of workflow used to generate or process this file */
	//workflow_type: string
	/** A string as the project id of the case */
	project_id: string
}

export type ExperimentalStrategy = {
	targeted: 'Targeted Sequencing'
	wxs: 'WXS'
}

export type GdcMafRequest = {
	/** Name of exp strategy to get maf files for */
	experimentalStrategy: ExperimentalStrategy
	/** JSON, optional GDC cohort filter to restrict cases; if supplied, will only get maf files for these cases. the filter is readonly and pass to GDC API query */
	filter0?: any
}

export type GdcMafResponse = {
	/** List of file objects passing filter and to be displayed on client */
	files: GdcMafFile[]
	/** Total number of files found by API (in case bigger than files.length) */
	filesTotal: number
	/** Maximum total size of maf files allowed, for indicating on ui while selecting files */
	maxTotalSizeCompressed: number
}

export const gdcMafPayload: RoutePayload = {
	request: {
		typeId: 'GdcMafRequest'
	},
	response: {
		typeId: 'GdcMafResponse'
	}
	//examples: []
}
