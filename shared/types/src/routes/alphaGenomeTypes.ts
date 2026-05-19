export type alphaGenomeTypesRequest = {
	dslabel: string
}
export type alphaGenomeTypesResponse = {
	/** the alpha genome ontology terms supported by the dataset */
	ontologyTerms: any[]
	/** the alpha genome output types */
	outputTypes: any[]
	intervals: number[]
}

// TODO: write payload examples to help with automated testing and documentation, for non-prod use only
