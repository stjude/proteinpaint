import type { TermGroupSetting, TermValues, BaseTerm } from '../index.ts'

/*
For term type 'snp'
*/

export type CategoricalTerm = BaseTerm & {
	id: string
	name?: string
	type: 'categorical'
	values: TermValues
	groupsetting: TermGroupSetting
}

export type RawCategoricalTerm = CategoricalTerm & {
	groupsetting?: TermGroupSetting
	values?: TermValues
}
