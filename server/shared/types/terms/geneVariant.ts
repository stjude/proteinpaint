import {
	MinBaseQ,
	BaseTerm,
	TermGroupSetting,
	QGroupSetting,
	EnabledTermGroupSetting,
	ValuesQ,
	BaseTW,
	PredefinedGroupSettingQ,
	CustomGroupSettingQ
} from './term'
import { TermSettingInstance } from '../termsetting'

type GeneVariantBaseTerm = BaseTerm & { groupsetting: EnabledTermGroupSetting }

type Coord = {
	chr: string
	start: number
	stop: number
}

type GeneVariantCoordTerm = GeneVariantBaseTerm &
	Coord & {
		kind: 'coord'
	}

export type GeneVariantGeneTerm =
	| (GeneVariantBaseTerm & {
			kind: 'gene'
			gene: string
	  })
	| (GeneVariantBaseTerm & {
			kind: 'gene'
			gene: string
	  } & Coord)

export type GeneVariantTerm = GeneVariantGeneTerm | GeneVariantCoordTerm

export type BaseGeneVariantQ = MinBaseQ & {
	cnvGainCutoff?: number
	cnvMaxLength?: number
	cnvMinAbsValue?: number
	cnvLossCutoff?: number
	exclude: string[]
	dt?: number
	origin?: string
}

export type GeneVariantQ = BaseGeneVariantQ & (ValuesQ | PredefinedGroupSettingQ | CustomGroupSettingQ)

export type GeneVariantTW = BaseTW & {
	term: GeneVariantTerm
	q: GeneVariantQ
}

export type GeneVariantTermSettingInstance = TermSettingInstance & {
	q: GeneVariantQ
	term: GeneVariantTerm
	category2samplecount: any
	groupSettingInstance?: any
}
