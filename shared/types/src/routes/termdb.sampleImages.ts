export type TermdbSampleImagesRequest = {
	genome: string
	/** Ds label */
	dslabel: string
	sampleId: number
}

export type Image = {
	src: any
}

export type TermdbSampleImagesResponse = {
	images: Image[]
}

// TODO: write payload examples to help with automated testing and documentation, for non-prod use only
