import type { FileORURL } from '../fileOrUrl.ts'
import type { ErrorResponse } from './errorResponse.ts'
import type { Filter } from '../filter.ts'

export type TermdbJunctionsRequest = {
	genome: string
	dslabel: string
	rglst: any
	filter?: Filter
	filter0?: any
	minReadCount?: number
}
export type TermdbJunctionsResponse =
	| {
			junctions: {
				chr: string
				start: number
				stop: number
				strand: string
				type: string
				// more properties
				sampleCount: number
				medianReadCount: number
			}[]
			error?: string
	  }
	| ErrorResponse

export type TermdbJunctionOneSampleTkRequest = FileORURL & {
	genome: string
	rglst: any
	indexURL?: string
	isrnapeg?: 1
	bincount?: number
}

export type TermdbJunctionOneSampleTkItem = {
	chr: string
	start: number
	stop: number
	type: string
	rawdata: number[]
}

export type TermdbJunctionOneSampleTkResponse = {
	lst?: TermdbJunctionOneSampleTkItem[]
	error?: string
}
