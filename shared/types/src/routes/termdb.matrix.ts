import type { Filter } from '../filter.ts'
import type { TermWrapper } from '../terms/tw.ts'

export type TermdbMatrixRequest = {
	genome: string
	dslabel: string
	terms: TermWrapper[]
	filter?: Filter
	filter0?: any
	embedder?: string
	isHierCluster?: boolean
	isSummary?: boolean
	currentGeneNames?: string[] | null
	getPlotDataByName?: string
	[k: string]: any
}

export type ObjectAssign = {
	[key: string]: object
}

/** Matrix responses are sent as an NDJSON-nested-key stream by the server. */
export type TermdbMatrixResponse = {
	samples: Record<string, any>
	refs: {
		byTermId: Record<string, any>
		bySampleId: Record<string, any>
		$codes?: {
			objAssign?: ObjectAssign
			copyAs?: Record<string, string>
		}
	}
}
