import type { ErrorResponse } from './errorResponse.ts'
import type { Filter } from '../filter.ts'

export type TermdbRelatedSamplesRequest = {
	/** Genome id */
	genome: string
	/** Dataset label */
	dslabel: string
	/** id of the sample whose related samples are returned */
	sampleId: number
	/** only the samples passing the filter are returned */
	filter?: Filter
}

export type RelatedSample = {
	sampleId: number
	sampleName: string
}

type ValidResponse = {
	/** the samples under the root sample of the requested sample (e.g. a patient's primary, PDX and CSF samples),
	in tree order with children sorted by name; the root is listed first, except a root of the root sample type
	that has children, as it groups them. Empty when the requested sample does not pass the filter */
	samples: RelatedSample[]
	/** the root sample (e.g. the patient), which may be the requested sample; absent when .samples is empty */
	root?: RelatedSample
}

export type TermdbRelatedSamplesResponse = ValidResponse | ErrorResponse
