import type { Filter } from '../filter.ts'

type JsonObject = Record<string, unknown>

export type Mds3Region = {
	chr: string
	start: number
	stop: number
	width?: number
	reverse?: boolean
}

export type Mds3CnvDensityRequest = {
	width: number
	barheight: number
	pcolor: string
	ncolor: string
}

export type Mds3SkewerRimRequest = {
	type: string
	formatKey?: string
	rim1value?: unknown
	rim2value?: unknown
	hiddenvaluelst?: unknown[]
}

/**
 * Request for the multiplexed termdb/mds3 endpoint.
 *
 * The endpoint primarily loads mutation-track data, but datasets may expose
 * additional query modes through the same route. Those dataset-specific
 * parameters are permitted by the index signature.
 */
export type TermdbMds3Request = {
	genome: string
	dslabel?: string
	embedder?: string

	forTrack?: boolean | number
	skewer?: boolean | number
	isoform?: string
	gene?: string
	rglst?: Mds3Region[]

	filter0?: JsonObject
	filterObj?: Filter
	hiddenmclasslst?: string
	infoFilter?: Record<string, unknown[]>
	formatFilter?: Record<string, unknown[]>
	skewerRim?: Mds3SkewerRimRequest

	cnvMaxLength?: number
	cnvGainCutoff?: number
	cnvLossCutoff?: number
	cnvDensity?: Mds3CnvDensityRequest
	devicePixelRatio?: number

	bcffile?: string
	bcfurl?: string
	bcfindexURL?: string

	singleSampleGenomeQuantification?: { dataType: string; sample: string | number }
	singleSampleGbtk?: { dataType: string; sample: string | number }
	ssm2canonicalisoform?: boolean | number
	variant2samples?: boolean | number | JsonObject
	m2csq?: boolean | number
	ssm_id?: string

	[key: string]: unknown
}

export type Mds3Sample = {
	sample_id: string | number
	[key: string]: unknown
}

export type Mds3SkewerVariant = {
	chr?: string
	pos?: number
	start?: number
	stop?: number
	class?: string
	dt?: number
	mname?: string
	ssm_id?: string
	occurrence?: number
	pairlst?: JsonObject[]
	pairlstIdx?: number
	formatK2count?: Record<string, unknown>
	[key: string]: unknown
}

export type Mds3Cnv = {
	chr?: string
	start: number
	stop: number
	class?: string
	value?: number
	samples?: Mds3Sample[]
	[key: string]: unknown
}

export type Mds3CnvDensityPlot = {
	src: string
	[key: string]: unknown
}

export type Mds3TrackResponse = {
	variantAlerts: string[]
	skewer?: Mds3SkewerVariant[]
	cnv?: {
		cnvs: Mds3Cnv[]
		cnvMsg?: string
		[key: string]: unknown
	}
	cnvDensity?: {
		cnvMsg?: string
		gain: Mds3CnvDensityPlot
		loss: Mds3CnvDensityPlot
		max: number
		segmentCount: number
	}
	mclass2variantcount?: unknown[]
	sampleTotalNumber?: number
}

export type TermdbMds3Response =
	| Mds3TrackResponse
	| {
			error: string
	  }
	| {
			/** Response from one of the endpoint's dataset-specific auxiliary query modes. */
			[key: string]: unknown
	  }
