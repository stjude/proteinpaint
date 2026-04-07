export type SummaryScaffold = {
	tw1: string
	tw2?: string
	tw3?: string
	filter?: string
}
export type DEScaffold = {
	filter1: string
	filter2: string
	filter?: string
}

export type MatrixScaffold = {
	twLst: string[]
	divideBy?: string
	filter?: string
}

export type Scaffold = SummaryScaffold | DEScaffold | MatrixScaffold

// Helper functions to determine scaffold type
export function isSummaryScaffold(s: Scaffold): s is SummaryScaffold {
	return 'tw1' in s
}

export function isDEScaffold(s: Scaffold): s is DEScaffold {
	return 'filter1' in s && 'filter2' in s
}

export function isMatrixScaffold(s: Scaffold): s is MatrixScaffold {
	return 'twLst' in s
}

export type InferEntity = {
	termType: 'dictionary' | 'geneExpression' | 'dnaMethylation' | 'geneVariant' | 'proteomeAbundance'
	phrase: string
}

export type SummaryPhrase2EntityResult = {
	tw1: [InferEntity]
	tw2?: [InferEntity]
	tw3?: [InferEntity]
	filter?: [InferEntity]
}
