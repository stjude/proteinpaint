import type {
	GroupSettingQ,
	ValuesQ,
	BaseTW,
	PredefinedGroupSettingQ,
	CustomGroupSettingQ,
	RawCategoricalTerm,
	CategoricalTerm,
	RawSnpTerm,
	SnpTerm
} from '../index.ts'
import type { RawValuesQ, RawPredefinedGroupsetQ, RawCustomGroupsetQ, MinBaseQ } from './q.ts'

/**
 * A raw qualitative termwrapper object, before filling-in
 *
 * test:QualitativeQ:
 *
 * @category TW
 */

export type RawQualTerm = RawCategoricalTerm | RawSnpTerm
export type QualTerm = CategoricalTerm | SnpTerm

export type RawQualTWValues = BaseTW & {
	type?: 'QualTWValues'
	/** must already exist, for dictionary terms, TwRouter.fill() will use mayHydrateDictTwLst() */
	term: RawQualTerm
	q: RawValuesQ
}

export type RawQualTWPredefinedGS = BaseTW & {
	type?: 'QualTWPredefinedGS'
	term: RawQualTerm
	q: RawPredefinedGroupsetQ
}

export type RawQualTWCustomGS = BaseTW & {
	type?: 'QualTWCustomGS'
	term: RawQualTerm
	q: RawCustomGroupsetQ
}

export type RawQualTW = RawQualTWValues | RawQualTWPredefinedGS | RawQualTWCustomGS

export type QualBaseQ = MinBaseQ & {
	mode?: 'discrete' | 'binary'
}

export type QualQ = GroupSettingQ | ValuesQ

export type QualTWValues = BaseTW & {
	//id: string
	term: QualTerm
	q: ValuesQ
	type: 'QualTWValues'
}

export type QualTWPredefinedGS = BaseTW & {
	term: QualTerm
	q: PredefinedGroupSettingQ
	type: 'QualTWPredefinedGS'
}

export type QualTWCustomGS = BaseTW & {
	term: QualTerm
	q: CustomGroupSettingQ
	type: 'QualTWCustomGS'
}

export type QualTW = QualTWValues | QualTWPredefinedGS | QualTWCustomGS
