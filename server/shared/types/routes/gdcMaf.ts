// an object representing gdc maf file, to be shown on client table
type File = {
	id: string // file uuid, allow to access content via https://api.gdc.cancer.gov/data/<uuid>
	case_submitter_id: string
	experimental_strategy: string
	file_size: string // todo
	sample_types: string
	workflow_type: string
}

export type GdcMafResponse = {
	files: Files[]
}
