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
	/** for a junction with an intron retention event, of its samples, those with a nonzero IR ratio.
	Absent when there is none, and the IR type is then also removed from types[] */
	IR?: {
		sampleCount: number
		/** median IR ratio of these samples */
		medianRatio: number
	}
	/**
	/AbyB route calls q.listJunctions(, keepLst) to only return given junctions
	along with sn2rc for downstream processing
	*/
	sn2rc?: Map<string | number, number>
	/** with keepLst, for a junction with an intron retention event: k: sample id of sn2rc, v: its IR ratio, 0 for none */
	sn2ir?: Map<string | number, number>
	/**
	in /junctions route response, if a junction is singleton, its sample name will be attached for showing in j2 tk
	this avoids making another request to get the sample name
	*/
	sampleName?: string | number
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
	/** the sample types to read, chosen for the genome browser track; absent reads every sample */
	sampleTypes?: number[]
	/** also return matrix{} of read counts by sample, for this many junctions found in the most samples */
	matrixTop?: number
}
export type TermdbJunctionsDataResponse = {
	junctions: Junction[]
	/** max read count from all allowed samples */
	maxReadCount: number
	alert?: string
	/** read counts by sample of the junctions found in the most samples, when matrixTop was requested */
	matrix?: {
		/** names of the samples that the request covers; absent when the user may not see sample names */
		samples?: (string | number)[]
		/** most frequent first */
		junctions: {
			chr: string
			start: number
			stop: number
			strand: string
			/** per sample, aligned with samples[]; 0 for a sample without the junction or below readcountCutoff */
			readcounts: number[]
		}[]
	}
}
export type TermdbJunctionsResponse = TermdbJunctionsDataResponse | ErrorResponse

//////////////////// get median read counts for jA, over samples in jB
export type TermdbJunctionsAbyBRequest = {
	genome: string
	dslabel: string
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
/*
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
*/

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
