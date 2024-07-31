import { BaseQ, BaseTerm, GroupSettingTerm, BaseTW } from './term'
import { TermSettingInstance } from '../termsetting'

export type GeneVariantQ = BaseQ & {
	cnvGainCutoff?: number
	cnvMaxLength?: number
	cnvMinAbsValue?: number
	cnvLossCutoff?: number
	exclude: string[]
	dt?: number
	origin?: string
}

type GeneVariantBaseTerm = BaseTerm & { groupsetting: GroupSettingTerm }

type GeneVariantCoordTerm = GeneVariantBaseTerm & {
	kind: 'coord'
	chr: string
	start: number
	stop: number
}

export type GeneVariantGeneTerm = GeneVariantBaseTerm & {
	kind: 'gene'
	gene: string
	chr?: string
	start?: number
	stop?: number
}

export type GeneVariantTerm = GeneVariantGeneTerm | GeneVariantCoordTerm

export type GeneVariantTW = BaseTW & {
	q: GeneVariantQ
	term: GeneVariantTerm
}

export type GeneVariantTermSettingInstance = TermSettingInstance & {
	q: GeneVariantQ
	term: GeneVariantTerm
	category2samplecount: any
	groupSettingInstance?: any
}
