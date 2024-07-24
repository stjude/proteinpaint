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

export type GeneVariantTerm = BaseTerm & {
	groupsetting: TermGroupSetting
}

export type GeneVariantCoordTerm = GeneVariantTerm & {
	chr: string
	start: number
	stop: number
}

export type GeneVariantGeneTerm = GeneVariantTerm & {
	gene: string
	chr?: string
	start?: number
	stop?: number
}

export type GeneVariantTermSettingInstance = TermSettingInstance & {
	q: GeneVariantQ
	term: GeneVariantTerm
	category2samplecount: any
}
