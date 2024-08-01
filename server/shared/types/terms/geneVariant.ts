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

export type GeneVariantTermSettingInstance = TermSettingInstance & {
	q: GeneVariantQ
	term: GeneVariantTerm
	category2samplecount: any
	groupSettingInstance?: any
}

type ValuesQ = {
	type?: 'values'
}
