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
	sn2rc?: any
}

//////////////////// list junctions from rglst
export type TermdbJunctionsRequest = {
	genome: string
	dslabel: string
	rglst: any
	filter?: Filter
	filter0?: any
	readcountCutoff?: number
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

//////////////////// get median read counts for jA, over samples in jB
export type TermdbJunctionsAbyBRequest = {
	genome: string
	dslabel: string
	rglst: any
	filter?: Filter
	filter0?: any
	readcountCutoff?: number
	/** "jB", the junction that shows an event */
	junctionB: {
		chr: string
		start: number
		stop: number
		strand: string
	}
	/** each element is one "jA", the canonical junction that accompanies jB */
	junctionAposlst: [number, number, string][]
}
export type TermdbJunctionsAbyBDataResponse = {
	/** each item is one jA. */
	lst: {
		start: number
		stop: number
		strand: string
		/** median read count value for samples of this jA that are also in jB */
		v: number
	}[]
}
export type TermdbJunctionsAbyBResponse = TermdbJunctionsAbyBDataResponse | ErrorResponse

//////////////////// get details of one junction
export type TermdbOneJunctionRequest = {
	genome: string
	dslabel: string
	junction: Junction
	filter?: Filter
	filter0?: any
	readcountCutoff?: number
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
