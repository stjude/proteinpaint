import type { Filter } from '../filter.ts'
import type { TermWrapper } from '../terms/tw.ts'

export type TermdbMatrixRequest = {
	genome: string
	dslabel: string
	terms?: TermWrapper[]
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

/** Matrix data response, sent as an NDJSON-nested-key stream by the server. */
export type TermdbMatrixDataResponse = {
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

/** Sent as-is when req.getPlotDataByName is set: the raw matrixConfig of a premade
 * matrix plot (see MatrixPlotsEntry in dataset.ts), read from a dataset-supplied JSON
 * file and optionally transformed by that entry's getConfig(). Its keys get merged into
 * the client's matrix plot config (see matrix.config.js), so the shape is open-ended. */
export type TermdbMatrixConfigResponse = {
	[key: string]: any
}

export type TermdbMatrixResponse = TermdbMatrixDataResponse | TermdbMatrixConfigResponse
