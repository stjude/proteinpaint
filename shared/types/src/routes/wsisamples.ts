export type WSISamplesRequest = {
	genome: string
	dslabel: string
}

export type WSISamplesResponse = {
	samples: Array<WSISample>
	error?: string
}

export type WSISample = {
	sampleId: string
	wsimages: Array<string>
}

// TODO: write payload examples to help with automated testing and documentation, for non-prod use only
