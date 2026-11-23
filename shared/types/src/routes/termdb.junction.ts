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
	/** with the request's groupTw of two groups: the Wilcoxon rank-sum p of the junction's share of each sample's reads
	of the junctions of its gene (in groupRegion, else in view) between the groups, its BH q over the junctions tested,
	each group's mean share, in the order of the response's groups[], and the gene. groupShares without p: not tested, as
	its share is below the least that is tested in both groups; none of them for a junction of no gene or of two */
	p?: number
	q?: number
	groupShares?: [number, number]
	gene?: string
}

//////////////////// list junctions from rglst
export type TermdbJunctionsRequest = {
	genome: string
	dslabel: string
	rglst: any
	/** pp filter of samples, as filterObj of the mds3 track */
	filterObj?: Filter
	filter0?: any
	readcountCutoff?: number
	/** comma-joined types to filter out junctions */
	hiddenTypes?: string
	/** the sample types to read, chosen for the genome browser track; absent reads every sample */
	sampleTypes?: number[]
	/** also return matrix{} of read counts by sample, for this many junctions found in the most samples */
	matrixTop?: number
	/** a samplelst tw of two groups, the first the reference: each junction gets p, q and groupShares, see Junction */
	groupTw?: any
	/** with groupTw, the region whose junction reads are a sample's total, e.g. the gene the view was opened on, so that
	the shares and their tests do not change as the view moves; absent, the junctions in view */
	groupRegion?: { chr: string; start: number; stop: number }
}
export type TermdbJunctionsDataResponse = {
	junctions: Junction[]
	/** max read count from all allowed samples */
	maxReadCount: number
	/** number of junctions read from the file in rglst, including those not returned in junctions[],
	e.g. of no sample passing the filter or read count cutoff, or of hidden types; absent when no sample passes the filter */
	totalCount?: number
	alert?: string
	/** with groupTw: each group with its number of samples that have junction reads in view, as tested */
	groups?: { name: string; n: number }[]
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
	/** pp filter of samples, as filterObj of the mds3 track */
	filterObj?: Filter
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
