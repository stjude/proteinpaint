import type {
	BaseTerm,
	TermGroupSetting,
	RawQualTW,
	QualTW /*ValuesQ, PredefinedGroupSettingQ, CustomGroupSettingQ*/
} from '../index.ts'

/*
For term type 'snp'
*/

export type SnpTerm = BaseTerm & {
	type: 'snp'
	chr: string
	start: number
	stop: number
	ref: string
	alt: string[]
	groupsetting: TermGroupSetting
}

export type RawSnpTW = RawQualTW & { term: SnpTerm; type?: string }

export type SnpTW = QualTW & { term: SnpTerm }

// export type SnpValues = { term: SnpTerm, q: ValuesQ }

// export type SnpPredefinedGS = { term: SnpTerm, q: PredefinedGroupSettingQ }

// export type SnpCustomGS = { term: SnpTerm, q: CustomGroupSettingQ }
