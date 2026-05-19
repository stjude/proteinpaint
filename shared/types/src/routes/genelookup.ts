export type GeneLookupRequest = {
	input: string
	genome: string
	deep: boolean
}

export type GeneLookupResponse = {
	error?: string
	hits: string[]
}

// TODO: write payload examples to help with automated testing and documentation, for non-prod use only
