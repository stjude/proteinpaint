export type GetBrainImagingRequest = {
	genome: string
	dslabel: string
	refKey: string
	samplesOnly?: boolean
	l?: string
	f?: string
	t?: string
	selectedSampleFileNames?: string[]
}

export type GetBrainImagingResponse = {
	brainImage: string
}
