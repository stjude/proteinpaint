import { TermWrapper, BaseQ, Term } from '../termdb'
import { TermSettingInstance } from '../termsetting'

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

export type GeneVariantTerm = Term & {
	isoform: string
}

export type GeneVariantTermSettingInstance = TermSettingInstance & {
	q: GeneVariantQ
	term: GeneVariantTerm
}
