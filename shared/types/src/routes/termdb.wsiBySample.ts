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
	/** number of images (spatial + plain) in the sample's folders */
	count: number
}

export type WsiImage = {
	/** discriminates the WsiImage | SpatialImage union */
	type: 'wsi'
	/** slide path relative to the sample's folder under ds.queries.w2.wsiFolder
	 (<imageName>/<slide file>); used as the wsitiles wsimage= param */
	fileName: string
	/** relative URL of a small preview (the slide's z=0 tile); client prepends host */
	thumbnail?: string
	/** free-form metadata string from the wsimages table */
	metadata?: string
}

/** A spatial (Xenium) image: the morphology slide plus its companion overlay
 files found in the same image folder (located by the ds.queries.w2 *FileSuffix
 fields). Fields mirror the direct-viewer URL params
 (?image_file=&cell_boundaries=&nucleus_boundaries=
 &gene_expression_file=&gene_expression=&annotation_level=). Companion file
 paths are relative to serverconfig.tpmasterdir, matching the wsitiles
 boundaries/genecounts ?file= param. */
export type SpatialImage = {
	type: 'spatial'
	/** = image_file: slide path relative to the sample's folder under
	 ds.queries.w2.folder (<imageName>/<tif file>); used as the wsitiles wsimage= param */
	fileName: string
	/** = spatial_data: the consolidated .h5ad — the single source of the
	 image's boundaries, cell-type annotations and gene expression */
	spatialData?: string
	/** = gene_expression: comma-separated genes to overlay */
	geneExpression?: string
	/** = annotation_level: show boundary strokes only in the n most zoomed-in levels */
	annotationLevel?: number
	/** = cell_types: fill cells by their annotated type by default */
	cellTypes?: boolean
	/** relative URL of a small preview (the slide's z=0 tile); client prepends host */
	thumbnail?: string
}

export type WsiBySampleResponse = {
	/** present when sample_id was given: that sample's images */
	images?: (WsiImage | SpatialImage)[]
	/** present when sample_id was omitted: every sample with an image folder */
	samples?: WsiSampleSummary[]
	status?: string
	error?: string
}
