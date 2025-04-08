import type { MinBaseQ, BaseTerm, TermGroupSetting, BaseTW, GroupSettingQ, ValuesQ, TermValues } from '../index.ts'
import type { TermSettingInstance } from '../termsetting.ts'

export type GeneVariantBaseQ = MinBaseQ & {
	cnvGainCutoff?: number
	cnvMaxLength?: number
	cnvMinAbsValue?: number
	cnvLossCutoff?: number
	exclude: string[]
	dt?: number
	origin?: string
}

export type GeneVariantQ = GeneVariantBaseQ & (ValuesQ | GroupSettingQ)

type GeneVariantBaseTerm = BaseTerm & {
	type: 'geneVariant'
	groupsetting: TermGroupSetting
}

export type GeneVariantGeneTerm = GeneVariantBaseTerm & {
	kind: 'gene'
	gene: string
	// chr,start,stop should exist together as a separate type called
	// 'Coord', but hard to code as atomic `& Coord` because it may
	// need to be filled in
	chr?: string
	start?: number
	stop?: number
}

export type GeneVariantCoordTerm = GeneVariantBaseTerm & {
	kind: 'coord'
	chr: string
	start: number
	stop: number
}

export type GeneVariantTerm = GeneVariantGeneTerm | GeneVariantCoordTerm

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

export type DtTerm = {
	id: string
	name: string
	parent_id: any
	isleaf: boolean
	type: string
	dt: number
	origin?: string
	values?: TermValues
	min?: number
	max?: number
}
