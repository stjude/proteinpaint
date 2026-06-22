export const IDC_BUCKET_URL = 'https://storage.googleapis.com/idc-index-data-artifacts/'
export const IDC_PARQUET_KEY_SUFFIX = '/release_artifacts/gdc_idc_mapping.parquet'
export const IDC_PARQUET_CURRENT_URL = `${IDC_BUCKET_URL}current${IDC_PARQUET_KEY_SUFFIX}`

// Label used to identify the "current" (latest published) parquet artifact.
export const IDC_CURRENT_VERSION_LABEL = 'current'

// Key in the parquet footer key/value metadata that holds the IDC index data
// version (e.g. "24.2.1-0-g119c0c7").
export const IDC_DATA_VERSION_METADATA_KEY = 'idc_index_data_version'

// Columns list for IDC parquet reads
export const IDC_PARQUET_COLUMNS = [
	'collection_id',
	'PatientID',
	'StudyInstanceUID',
	'StudyDate',
	'StudyDescription',
	'study_type',
	'gdc_case_id'
]

// Type for a single row read from the IDC parquet index.
export type IDCParquetData = {
	PatientID: string
	collection_id: string
	StudyInstanceUID: string
	StudyDate: string
	StudyDescription: string
	study_type: string
	gdc_case_id: string
}

// Result of reading an IDC parquet index file.
export interface IDCParquetIndexResult {
	idc_data: ReadonlyArray<IDCParquetData>
	case_ids: readonly string[]
	dataVersion?: string
}

export type IDCStudy = {
	StudyInstanceUID: string
	collectionId: string
	series: any[]
	hasWSI: boolean
	hasRadiology: boolean
	StudyDate?: string
	StudyDescription?: string | null
}

export type IDCViewerRow = {
	caseId: string
	programName: string
	project: string
	studiesList: IDCStudy[]
	studiesCount: number
	wsiCount: number
	radiologyCount: number
}

export interface IDCVersionedEntry {
	version: string
	url: string
}

export interface IDCParquetLoadResult {
	idc_data: ReadonlyArray<IDCParquetData>
	case_ids: readonly string[]
	// Version label of the artifact that was successfully loaded, e.g.
	// "current" or "23.6.0".
	urlVersion: string
	// The fully-qualified URL the data was loaded from.
	url: string
	// Version embedded in the parquet footer key/value metadata
	// (idc_index_data_version), e.g. "24.2.1-0-g119c0c7". Undefined when the
	// metadata key is absent.
	metadataVersion?: string
}

export interface ResponseHit {
	case_id: string
	disease_type: string
	id: string
	primary_site: string
	project: {
		project_id: string
		program: {
			name: string
		}
	}
	samples: any[]
	submitter_id: string
}

export interface Pagination {
	count: number
	from: number
	page: number
	pages: number
	size: number
	sort: string
	total: number
}

export interface CasesResponse {
	data: { hits: Array<ResponseHit>; pagination: Pagination }
}
