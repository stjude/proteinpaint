export type WsiBySampleRequest = {
	genome: string
	dslabel: string
	/** sample name = the sample's subfolder under a ds.queries.w2 root
	 (folder for spatial, wsiFolder for plain); omit to list the samples that
	 have plain slides — spatial-only samples are not listed, their images are
	 fetched per sample_id by the single-cell app */
	sample_id?: string
	/** only with sample_id: enumerate just this root ('wsi' = wsiFolder,
	 'spatial' = folder), so the other tree is never read or stat'ed; omit
	 for both kinds */
	imageType?: 'spatial' | 'wsi'
}

/** one sample that has plain whole-slide images on disk (the standalone
 Whole Slide Images plot's sample table; spatial images are excluded) */
export type WsiSampleSummary = {
	sampleId: string
	/** number of plain slides in the sample's wsiFolder subfolder — NOT the
	 total image count; spatial images are not included */
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
	/** present when sample_id was given: that sample's images, BOTH kinds
	 (the single-cell app's spatial probe/viewer rely on spatial entries here) */
	images?: (WsiImage | SpatialImage)[]
	/** present when sample_id was omitted: every sample with at least one
	 plain slide (spatial-only samples are not listed) */
	samples?: WsiSampleSummary[]
	status?: string
	error?: string
}
