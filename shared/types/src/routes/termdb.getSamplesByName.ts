import type { ErrorResponse } from './errorResponse.ts'
import type { Filter } from '../filter.ts'

export type TermdbGetSamplesByNameRequest = {
	/** Genome id */
	genome: string
	/** Dataset label */
	dslabel: string
	/** the host name of the embedding page */
	embedder?: string
	/** only the samples passing the filter are returned; without it, all samples of the dataset are returned,
	with only their id */
	filter?: Filter
}

export type SampleByName = {
	/** termdb sample id */
	id: number
	/** sample name */
	name?: string
	/** nearest ancestor, when the sample has one */
	ancestor_id?: number | null
	ancestor_name?: string
	/** sample type, when available */
	sample_type?: number | null
}

/** the samples by sample name; empty when the request may not read sample names */
export type SamplesByName = { [sampleName: string]: SampleByName }

export type TermdbGetSamplesByNameResponse = SamplesByName | ErrorResponse
