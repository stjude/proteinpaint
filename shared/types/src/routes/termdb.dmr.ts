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
