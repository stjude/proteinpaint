import type { Selection } from 'd3-selection'

export type IDCParquetData = {
	PatientID: string
	collection_id: string
	StudyInstanceUID: string
	StudyDate: string
	StudyDescription: string
	study_type: string
	gdc_case_id: string
}

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
	/** Version label of the artifact that was successfully loaded, e.g. "current" or "23.6.0". */
	urlVersion: string
	/** The fully-qualified URL the data was loaded from. */
	url: string
	/** Version embedded in the parquet footer metadata (idc_index_data_version). */
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

export type SortByField = 'submitter_id' | 'project.project_id' | 'project.program.name'
export interface IDCViewerOpts {
	holder?: Selection<HTMLDivElement, unknown, any, any>
	filter0?: any
	searchFilter?: string
	sortBy: SortByField
	sortDirection: 'asc' | 'desc'
	action?: 'search'
	pageSize: number
	pageSizeOptions: number[]
	retries: number
	currentPage: number
}
