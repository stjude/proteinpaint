export type alphaGenomeRequest = {
	genome?: string
	dslabel?: string
	chromosome: string
	position: number
	reference: string
	alternate: string
	ontologyTerms: string[]
	outputType?: number
	interval: number
}

export type alphaGenomeResponse = {
	/** the alpha genome plot */
	plotImage: string
}

// TODO: write payload examples to help with automated testing and documentation, for non-prod use only
