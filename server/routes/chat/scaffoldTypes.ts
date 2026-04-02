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
