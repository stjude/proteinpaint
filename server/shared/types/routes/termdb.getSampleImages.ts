export type TermdbGetSampleImagesRequest = {
	genome: string
	/** Ds label */
	dslabel: string
	sampleId: number
}

export type Image = {
	src: any
}

export type TermdbGetSampleImagesResponse = {
	images: Image[]
}
