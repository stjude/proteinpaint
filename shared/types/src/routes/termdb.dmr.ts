import type { Filter } from '../filter.ts'

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
	// todo more params
	filter?: Filter
	__protected__?: any
}

type Sample = {
	sampleId: number | string
	sample: string
}

export type TermdbDmrSuccessResponse = {
	status: 'ok'
	dmrs: {
		chr: string
		start: number
		stop: number
		// todo more stats
	}[]
}

export type TermdbDmrErrorResponse = {
	error: string
}

export type TermdbDmrResponse = TermdbDmrSuccessResponse | TermdbDmrErrorResponse
