import type { Filter } from '../filter.ts'
import type { TermWrapper } from '../terms/tw.ts'
import type { ErrorResponse } from './errorResponse.ts'

export type getdescrstatsRequest = {
	/** genome label in the serverconfig.json */
	genome: string
	/** dataset label for the given genome */
	dslabel: string
	embedder: string
	/** wrapper of a numeric term, q.mode can be any as getData() will always pull sample-level values for summarizing */
	tw: TermWrapper
	/** if true, the (violin) plot is in log scale and must exclude 0-values from the stat */
	logScale?: boolean
	/** optional pp filter */
	filter?: Filter
	/** optional gdc filter */
	filter0?: any
}

interface entries {
	id: string
	label: string
	value: number
}

type ValidResponse = {
	values: entries[]
}

export type getdescrstatsResponse = ValidResponse | ErrorResponse
