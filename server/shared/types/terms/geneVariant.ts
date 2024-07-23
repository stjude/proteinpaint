import { TermWrapper } from './tw.ts'
import { BaseQ, BaseTerm, QGroupSetting, TermGroupSetting } from './term.ts'
import { TermSettingInstance } from '../termsetting.ts'

/*
--------EXPORTED--------
GeneVariantQ
GeneVariantTermWrapper
GeneVariantTermSettingInstance

*/

export type GeneVariantQ = BaseQ & {
	cnvGainCutoff?: number
	cnvMaxLength?: number
	cnvMinAbsValue?: number
	cnvLossCutoff?: number
	exclude: any //an array maybe?
	groupsetting: QGroupSetting
	dt?: number
	origin?: string
}

export type GeneVariantTW = TermWrapper & {
	q: GeneVariantQ
	term: GeneVariantTerm
}

export type GeneVariantCoordTerm = BaseTerm & {
	chr: string
	start: number
	stop: number
}

export type GeneVariantGeneTerm = BaseTerm & {
	gene: string
	chr?: string
	start?: number
	stop?: number
}

export type GeneVariantTerm =
	| GeneVariantCoordTerm
	| (GeneVariantGeneTerm & {
			groupsetting: TermGroupSetting
	  })

export type GeneVariantTermSettingInstance = TermSettingInstance & {
	q: GeneVariantQ
	term: GeneVariantTerm
	category2samplecount: any
}
