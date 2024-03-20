import { TermWrapper, BaseQ, Term } from '../termdb.ts'
import { TermSettingInstance } from '../termsetting.ts'

export type GeneExpressionQ = BaseQ & {
	// todo
}

export type GeneExpressionTW = TermWrapper & {
	q: GeneExpressionQ
	term: GeneExpressionTerm
}

export type GeneExpressionTerm = Term & {
	// required gene symbol
	gene: string
	//ensg?:string
}

export type GeneExpressionTermSettingInstance = TermSettingInstance & {
	q: GeneExpressionQ
	term: GeneExpressionTerm
}
