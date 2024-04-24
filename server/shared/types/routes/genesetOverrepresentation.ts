//export type genesetOverrepresentationResponse = {
//
//}

export type genesetOverrepresentationRequest = {
	sample_genes: string
	background_genes: string
	dbfile: string
	genome: string
	geneSetGroup: string
}

export type genesetOverrepresentationResponse = {
	pathways: string
}
