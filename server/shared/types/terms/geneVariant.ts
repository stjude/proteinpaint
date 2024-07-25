import { TermWrapper } from './tw.ts'
import { BaseQ, BaseTerm, QGroupSetting, TermGroupSetting } from './term.ts'
import { TermSettingInstance } from '../termsetting.ts'

/*
--------EXPORTED--------
GeneVariantQ
GeneVariantTW
GeneVariantTerm
GeneVariantCoordTerm
GeneVariantGeneTerm
GeneVariantTermSettingInstance

*/

export type GeneVariantQ = BaseQ & {
	cnvGainCutoff?: number
	cnvMaxLength?: number
	cnvMinAbsValue?: number
	cnvLossCutoff?: number
	exclude: string[]
	groupsetting: QGroupSetting
	dt?: number
	origin?: string
}

export type GeneVariantTW = TermWrapper & {
	q: GeneVariantQ
	term: GeneVariantTerm
}

export type GeneVariantTerm = GeneVariantCoordTerm | GeneVariantGeneTerm

export type GeneVariantCoordTerm = BaseTerm & {
	chr: string
	start: number
	stop: number
	groupsetting: TermGroupSetting
}

export type GeneVariantGeneTerm = BaseTerm & {
	gene: string
	chr?: string
	start?: number
	stop?: number
	groupsetting: TermGroupSetting
}

export type GeneVariantTermSettingInstance = TermSettingInstance & {
	q: GeneVariantQ
	term: GeneVariantTerm
	category2samplecount: any
}
