export type WsiBySampleRequest = {
	genome: string
	dslabel: string
	/** sample name = the sample's subfolder under ds.queries.w2.folder;
	 omit to list all samples that have images */
	sample_id?: string
}

/** one sample that has whole-slide images on disk */
export type WsiSampleSummary = {
	sampleId: string
	/** number of .svs files in the sample's folder */
	count: number
}

export type WsiImage = {
	fileName: string
	/** relative URL of a small preview (the slide's z=0 tile); client prepends host */
	thumbnail?: string
	/** free-form metadata string from the wsimages table */
	metadata?: string
}

export type WsiBySampleResponse = {
	/** present when sample_id was given: that sample's images */
	images?: WsiImage[]
	/** present when sample_id was omitted: every sample with an image folder */
	samples?: WsiSampleSummary[]
	status?: string
	error?: string
}
