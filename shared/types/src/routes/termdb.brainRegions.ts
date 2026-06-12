import type { ErrorResponse } from './errorResponse.ts'

export type BrainRegionsRequest = {
	genome: string
	dslabel: string
	gene: string
}

export type BrainRegionsEntry = {
	fold_change: number
	p_value: number
}

export type BrainRegionsIsoform = {
	gene_name: string
	data: {
		[disease: string]: {
			[region: string]: BrainRegionsEntry
		}
	}
}

export type BrainRegionsResponse =
	| ErrorResponse
	| {
			isoforms: { [isoformId: string]: BrainRegionsIsoform }
			regions: { [code: string]: string }
			diseases: string[]
			templateUrl: string
			svgUrl: string
	  }
