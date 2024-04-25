//export type genesetOverrepresentationResponse = {
//
//}

export type genesetOverrepresentationRequest = {
	sample_genes: string
	background_genes: string
	genome: string
	geneSetGroup: string
}

export type genesetOverrepresentationResponse = {
	pathways: string
}
