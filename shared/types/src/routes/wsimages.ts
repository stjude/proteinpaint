export type WSImagesRequest = {
	genome: string
	dslabel: string
	sampleId?: string
	wsimage: string
	aiProjectId?: number
}

export type WSImagesResponse = {
	// TileServer image session id
	wsiSessionId?: string
	overlays?: Array<PredictionOverlay>
	slide_dimensions: number[]
	mpp: number[]
	status: string
	error?: string
}

export type PredictionOverlay = {
	layerNumber: string
	predictionOverlayType: string
}

// TODO: write payload examples to help with automated testing and documentation, for non-prod use only
