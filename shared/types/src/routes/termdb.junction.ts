import type { FileORURL } from '../fileOrUrl.ts'
import type { ErrorResponse } from './errorResponse.ts'
import type { Filter } from '../filter.ts'

export type Junction = {
	chr: string
	start: number
	stop: number
	strand: string
	types: string[]
	info?: any
	sampleCount?: number
	medianReadCount?: number
	readcountBoxplot?: number[]
}
//////////////////// list junctions from rglst
export type TermdbJunctionsRequest = {
	genome: string
	dslabel: string
	rglst: any
	filter?: Filter
	filter0?: any
	minReadCount?: number
	/** comma-joined types to filter out junctions */
	hiddenTypes?: string
}
export type TermdbJunctionsDataResponse = {
	junctions: Junction[]
	/** max read count from all allowed samples */
	maxReadCount: number
	alert?: string
}
export type TermdbJunctionsResponse = TermdbJunctionsDataResponse | ErrorResponse

//////////////////// get details of one junction
export type TermdbOneJunctionRequest = {
	genome: string
	dslabel: string
	junction: Junction
	filter?: Filter
	filter0?: any
	minReadCount?: number
}
export type TermdbOneJunctionDataResponse = {
	some: any // todo
}
export type TermdbOneJunctionResponse = TermdbOneJunctionDataResponse | ErrorResponse

//////////////////// single sample junction tk
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
