export type MsgToUser = {
	type: 'text'
	text: string
}

// *** Scaffold Temp Types *** //
export type SummaryScaffold = {
	plotType: 'summary'
	tw1: string
	tw2?: string
	tw3?: string
	filter?: string
	chartType?: 'violin' | 'boxplot' | 'sampleScatter' | 'barchart' // optional, only for summary plot for now
}
export type DEScaffold = {
	plotType: 'dge'
	filter1: string
	filter2: string
	filter?: string
	method?: 'edgeR' | 'DESeq2' | 'limma' // optional, default to edgeR if not provided
}

export type MatrixScaffold = {
	plotType: 'matrix'
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

// *** Entity Temp Types *** //
type TermTypes = 'dictionary' | 'geneExpression' | 'dnaMethylation' | 'geneVariant' | 'proteomeAbundance'

export type Entity = {
	termType: TermTypes
	phrase: string
	logicalOperator?: '&' | '|' // optional, for filters
}

export type SummaryPhrase2EntityResult = {
	tw1: [Entity]
	tw2?: [Entity]
	tw3?: [Entity]
	filter?: Entity[] // These might use logical operators
}

export type DEPhrase2EntityResult = {
	filter1: Entity[] // will actually be nested structure later on
	filter2: Entity[] // will actually be nested structure later on
	filter?: Entity[]
	method?: 'edgeR' | 'DESeq2' | 'limma' // optional, default to edgeR if not provided
}

export type Phrase2EntityResult = SummaryPhrase2EntityResult | DEPhrase2EntityResult // | MatrixPhrase2EntityResult (to be defined later)
