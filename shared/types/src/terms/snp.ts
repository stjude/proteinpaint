import type { TermGroupSetting, TermValues, BaseTerm } from '../index.ts'

/*
For term type 'snp'
*/

export type SnpTerm = BaseTerm & {
	type: 'snp'
	id: string
	name: string
	chr: string
	start: number
	stop: number
	ref: string
	alt: string[]
	groupsetting: TermGroupSetting
	// may be used to hide
	values: TermValues
}

export type RawSnpTerm = SnpTerm & {
	groupsetting?: TermGroupSetting
	values?: TermValues
}
