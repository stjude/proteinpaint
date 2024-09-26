export type GetWSImagesRequest = {
	genome: string
	dslabel: string
	sampleId: string
	wsimage: string
}

export type GetWSImagesResponse = {
	sessionId: string
	slide_dimensions: number[]
	status: string
}
