import type { IDCViewerOpts } from '../IDCTypes'

export const IDC_BUCKET_URL = 'https://storage.googleapis.com/idc-index-data-artifacts/'
export const IDC_PARQUET_KEY_SUFFIX = '/release_artifacts/gdc_idc_mapping.parquet'
export const IDC_PARQUET_CURRENT_URL = `${IDC_BUCKET_URL}current${IDC_PARQUET_KEY_SUFFIX}`

export const IDC_CURRENT_VERSION_LABEL = 'current'

export const IDC_DATA_VERSION_METADATA_KEY = 'idc_index_data_version'

export const IDC_PARQUET_COLUMNS = [
	'collection_id',
	'PatientID',
	'StudyInstanceUID',
	'StudyDate',
	'StudyDescription',
	'study_type',
	'gdc_case_id'
]

/** Maximum number of GDC cases fetched in a single bulk request. */
export const MAX_CASES_LIMIT = 10000

const pageSizeOptions = [10, 20, 50, 100]
export const IDCViewerDefaults: IDCViewerOpts = {
	pageSizeOptions,
	sortBy: 'submitter_id',
	sortDirection: 'asc',
	pageSize: pageSizeOptions[0],
	retries: 3,
	currentPage: 1
}
