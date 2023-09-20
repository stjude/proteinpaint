// an object representing gdc maf file, to be shown on client table

/**
 * @id - A string representing the file's UUID (Universally Unique Identifier).
 * @case_submitter_id - (optional) - A string representing a submitter ID for the case associated with this file.
 * @experimental_strategy - A string representing the experimental strategy (scientific method) used for generating this file.
 * @file_size - A string representing the file size.
 * @sample_types - (optional) - A string representing the sample types associated with this file.
 * @workflow_type - A string representing the type of workflow used to generate or process this file.
 */
export type File = {
	id: string // file uuid, allow to access content via https://api.gdc.cancer.gov/data/<uuid>
	case_submitter_id?: string
	experimental_strategy: string
	file_size: string // todo
	sample_types?: string
	workflow_type: string
}

export type GdcMafResponse = {
	files: File[]
}
