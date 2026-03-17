import type { Filter } from '../filter.ts'
import type { RoutePayload } from './routeApi.ts'

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
	/** optional regulatory domain annotations for the GP model */
	annotations?: DmrAnnotation[]
	/** max fraction of NaN per probe before dropping (default 0.5) */
	nan_threshold?: number
	filter?: Filter
	__protected__?: any
}

type Sample = {
	sampleId: number | string
	sample: string
}

type DmrAnnotation = {
	name: string
	start: number
	end: number
	base_methylation?: number
	length_scale_bp?: number
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
