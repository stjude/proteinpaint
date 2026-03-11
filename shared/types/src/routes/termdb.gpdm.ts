import type { RoutePayload } from './routeApi.ts'

export type TermdbGpdmRequest = {
	genome: string
	dslabel: string
	/** Samples in group 1 (control) */
	group1: GpdmSample[]
	/** Samples in group 2 (case) */
	group2: GpdmSample[]
	/** Chromosome */
	chr: string
	/** Region start coordinate */
	start: number
	/** Region end coordinate */
	stop: number
	/** Optional annotation domains for the GP model */
	annotations?: GpdmAnnotation[]
	/** Max fraction NaN per probe before dropping (default 0.5) */
	nan_threshold?: number
	filter?: any
	__protected__?: any
}

type GpdmSample = {
	sampleId: number | string
	sample: string
}

type GpdmAnnotation = {
	name: string
	start: number
	end: number
	base_methylation?: number
	length_scale_bp?: number
}

export type GpdmDmr = {
	chr: string
	start: number
	stop: number
	width: number
	max_delta_beta: number
	probability: number
}

export type GpdmGrid = {
	positions: number[]
	group_a_mean: number[]
	group_a_lower: number[]
	group_a_upper: number[]
	group_b_mean: number[]
	group_b_lower: number[]
	group_b_upper: number[]
	difference_mean: number[]
	difference_lower: number[]
	difference_upper: number[]
	posterior_prob: number[]
}

export type TermdbGpdmSuccessResponse = {
	status: 'ok'
	/** Annotation-aware DMRs (primary result) */
	dmrs: GpdmDmr[]
	/** Naive single-kernel DMRs (comparison) */
	naive_dmrs: GpdmDmr[]
	/** Continuous posterior predictions for visualization */
	grid: GpdmGrid
	/** Analysis metadata */
	metadata: {
		n_probes: number
		n_samples_group1: number
		n_samples_group2: number
		region: string
	}
}

export type TermdbGpdmErrorResponse = {
	error: string
}

export type TermdbGpdmResponse = TermdbGpdmSuccessResponse | TermdbGpdmErrorResponse

export const TermdbGpdmPayload: RoutePayload = {
	request: {
		typeId: 'TermdbGpdmRequest'
	},
	response: {
		typeId: 'TermdbGpdmResponse'
	}
}
