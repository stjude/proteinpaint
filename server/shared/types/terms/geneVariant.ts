import { TermWrapper } from './tw.ts'
import { BaseQ, BaseTerm } from './term.ts'
import { TermSettingInstance } from '../termsetting.ts'

/*
--------EXPORTED--------
GeneVariantQ
GeneVariantTermWrapper
GeneVariantTermSettingInstance

*/

export type GeneVariantQ = BaseQ & {
	// termType: 'geneVariant'
	cnvGainCutoff?: number
	cnvMaxLength?: number
	cnvMinAbsValue?: number
	cnvLossCutoff?: number
	exclude: any //an array maybe?
}

export type GeneVariantTW = TermWrapper & {
	q: GeneVariantQ
	term: GeneVariantTerm
}

export type GeneVariantTerm =
	| (BaseTerm & {
			chr: string
			start: number
			stop: number
	  })
	| (BaseTerm & {
			gene: string
	  })

export type GeneVariantTermSettingInstance = TermSettingInstance & {
	q: GeneVariantQ
	term: GeneVariantTerm
}
