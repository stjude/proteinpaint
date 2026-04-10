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

type TermTypes = 'dictionary' | 'geneExpression' | 'dnaMethylation' | 'geneVariant' | 'proteomeAbundance'

//export type TwEntity = {
//    termType: TermTypes
//    phrase: string
//}
//
//export type FilterEntity = {
//    filter: TermTypes
//    phrase: string
//}
//
//export type Entity = TwEntity | FilterEntity

export type Entity = {
	termType: TermTypes
	phrase: string
}

// JSON schema types for the filter tree returned by evaluateFilterTerm()
export type FilterLeafNode = { leaf: string }
export type FilterLeafNodeEntity = { leaf: Entity }
export type FilterOperatorNode = { op: '&' | '|'; left: FilterTreeNode; right: FilterTreeNode }
export type FilterTreeNode = FilterLeafNode | FilterOperatorNode
export type FilterTreeResult = { sexpr: string; tree: FilterTreeNode }

export type FilterTreeNodeEntity = FilterLeafNodeEntity | FilterOperatorNode
export type FilterTreeResultEntity = { sexpr: string; tree: FilterTreeNodeEntity }

export type SummaryPhrase2EntityResult = {
	tw1: [Entity]
	tw2?: [Entity]
	tw3?: [Entity]
	filter?: FilterTreeResultEntity
}

export type DEPhrase2EntityResult = {
	filter1: FilterTreeResultEntity // will actually be nested structure later on
	filter2: FilterTreeResultEntity // will actually be nested structure later on
	filter?: FilterTreeResultEntity
}

export type Phrase2EntityResult = SummaryPhrase2EntityResult | DEPhrase2EntityResult // | MatrixPhrase2EntityResult (to be defined later)
