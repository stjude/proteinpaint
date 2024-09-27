export type GeneLookupRequest = {
	input: string
	genome: string
	deep: boolean
}

export type GeneLookupResponse = {
	error?: string
	hits: string[]
}
