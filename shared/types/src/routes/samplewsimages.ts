export type GetSampleWSImagesRequest = {
	genome: string
	dslabel: string
	sample_id: string
	wsimage: string
}

export type GetSampleWSImagesResponse = {
	sampleWSImages: string[]
}

export type WSImage = {
	filename: string
	metadata: string
}
