import { TermWrapper } from './tw.ts'
import { BaseQ, BaseTerm, GroupSetting } from './term.ts'
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
	groupsetting: GroupSetting
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
			groupsetting: GroupSetting
	  })

export type GeneVariantTermSettingInstance = TermSettingInstance & {
	q: GeneVariantQ
	term: GeneVariantTerm
	category2samplecount: any
}
