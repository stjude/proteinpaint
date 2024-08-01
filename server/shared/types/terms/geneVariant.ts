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

export type LooseGeneTerm = GeneVariantBaseTerm & {
	kind?: 'gene'
	gene?: string
	name: string
}

export type LooseCoordTerm = GeneVariantBaseTerm & {
	kind?: 'coord'
	name?: string
	chr: string
	start: number
	stop: number
}

export type LooseGeneVariantTerm = LooseGeneTerm | LooseCoordTerm

export type GeneVariantTW = BaseTW & {
	q: GeneVariantQ
	term: GeneVariantTerm
}

export type LooseGeneVariantTW = BaseTW & {
	q: Partial<GeneVariantQ>
	term: LooseGeneVariantTerm
}

export type GeneVariantTermSettingInstance = TermSettingInstance & {
	q: GeneVariantQ
	term: GeneVariantTerm
	category2samplecount: any
	groupSettingInstance?: any
}

type ValuesQ = {
	type?: 'values'
}
