import { TermWrapper } from './tw'
import { BaseQ, BaseTerm, QGroupSetting, TermGroupSetting } from './term'
import { TermSettingInstance } from '../termsetting'

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

type GeneVariantBaseTerm = BaseTerm & { groupsetting: TermGroupSetting }

type GeneVariantCoordTerm = GeneVariantBaseTerm & {
	by: 'coord'
	chr: string
	start: number
	stop: number
}

export type GeneVariantGeneTerm = GeneVariantBaseTerm & {
	by: 'gene'
	gene: string
	chr?: string
	start?: number
	stop?: number
}

export type GeneVariantTerm = GeneVariantCoordTerm | GeneVariantGeneTerm

export type GeneVariantTW = TermWrapper & {
	q: GeneVariantQ
	term: GeneVariantTerm
}

export type GeneVariantTermSettingInstance = TermSettingInstance & {
	q: GeneVariantQ
	term: GeneVariantTerm
	category2samplecount: any
}
