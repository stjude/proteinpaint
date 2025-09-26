import type { TermGroupSetting, TermValues } from '../index.ts'

/*
For term type 'snp'
*/

export type RawSnpTerm = SnpTerm & {
	groupsetting?: TermGroupSetting
	values?: TermValues
}

export type SnpTerm = {
	type: 'snp'
	id: string
	name: string
	chr: string
	start: number
	stop: number
	ref: string
	alt: string[]
	groupsetting: TermGroupSetting
	values: TermValues
	test: string
}

// export type RawSnpTW = RawQualTW & { term: SnpTerm; type?: string }

// export type SnpTW = QualTW & { term: SnpTerm }

// export type SnpValues = { term: SnpTerm, q: ValuesQ }

// export type SnpPredefinedGS = { term: SnpTerm, q: PredefinedGroupSettingQ }

// export type SnpCustomGS = { term: SnpTerm, q: CustomGroupSettingQ }
