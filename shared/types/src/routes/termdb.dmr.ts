import type { Filter } from '../filter.ts'
import type { RoutePayload } from './routeApi.ts'

/** Regulatory annotation passed to the GPDM Python analysis pipeline */
export type GpdmAnnotation = {
	name: string
	start: number
	end: number
}

export type TermdbDmrRequest = {
	genome: string
	dslabel: string
	/** list of samples from each group */
	group1: Sample[]
	group2: Sample[]
	/** query region */
	chr: string
	start: number
	stop: number
	/** max fraction of NaN per probe before dropping (default 0.5) */
	nan_threshold?: number
	/** bp flanking each CpG island used to derive Shore annotations (default 2000) */
	shoreSize?: number
	/** colors for the GP Model track PNG */
	colors?: { group1: string; group2: string; hyper: string; hypo: string }
	/** PNG resolution in dots per inch (default 100) */
	trackDpi?: number
	/** y-axis padding above and below the 0–1 beta range (default 0.1) */
	trackYPad?: number
	/** block track width in pixels — when provided with trackHeight, server returns a GP Model PNG */
	width?: number
	/** block track height in pixels */
	trackHeight?: number
	/** display name for group1 (e.g. from volcano plot) */
	group1Name?: string
	/** display name for group2 (e.g. from volcano plot) */
	group2Name?: string
	filter?: Filter
	__protected__?: any
}

type Sample = {
	sampleId: number | string
	sample: string
}

export type DmrAnnotationItem = {
	name: string
	chr: string
	start: number
	stop: number
	/** Annotation type: CGI, Shore, Promoter, Enhancer, CTCF */
	type: string
}

export type DmrDiagnostic = {
	probes: {
		positions: number[]
		mean_group1: number[]
		mean_group2: number[]
	}
	gp_posterior: {
		grid: number[]
		pred_group1: number[]
		pred_group2: number[]
		std_group1: number[]
		std_group2: number[]
		diff_mean: number[]
		ci_lower: number[]
		ci_upper: number[]
	}
	domains: {
		name: string
		type: string
		start: number
		end: number
		prior_mean: number
		prior_ls: number
		learned_ls: number | null
	}[]
	probe_spacings: number[]
}

export type TermdbDmrSuccessResponse = {
	status: 'ok'
	dmrs: {
		chr: string
		start: number
		stop: number
		width: number
		max_delta_beta: number
		/** hyper = group2 hypermethylated relative to group1; hypo = opposite */
		direction: 'hyper' | 'hypo'
		probability: number
	}[]
	/** Regulatory annotations used in the analysis (CpG islands, ENCODE cCREs) */
	annotations?: DmrAnnotationItem[]
	/** Diagnostic data: raw probes, GP posterior, domain params */
	diagnostic?: DmrDiagnostic
	/** Base64 PNG data URI of the GP Model plot, for embedding as a bigwig imgData track */
	trackImg?: string
}

export type TermdbDmrErrorResponse = {
	error: string
}

export type TermdbDmrResponse = TermdbDmrSuccessResponse | TermdbDmrErrorResponse

export const TermdbDmrPayload: RoutePayload = {
	request: {
		typeId: 'TermdbDmrRequest'
	},
	response: {
		typeId: 'TermdbDmrResponse'
	}
}
