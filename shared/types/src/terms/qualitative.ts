import type {
	GroupSettingQ,
	ValuesQ,
	BaseTW,
	PredefinedGroupSettingQ,
	CustomGroupSettingQ,
	CategoricalTerm,
	SnpTerm
} from '../index.ts'
import type { RawValuesQ, RawPredefinedGroupsetQ, RawCustomGroupsetQ, MinBaseQ } from './q.ts'

/**
 * A raw categorical term q object, before filling-in
 *
 * test:QualitativeQ:
 *
 * @category TW
 */

export type QualitativeTerm = CategoricalTerm | SnpTerm

export type RawQualTWValues = BaseTW & {
	type?: 'QualTWValues'
	/** must already exist, for dictionary terms, TwRouter.fill() will use mayHydrateDictTwLst() */
	term: QualitativeTerm
	q: RawValuesQ
}

export type RawQualTWPredefinedGS = BaseTW & {
	type?: 'QualTWPredefinedGS'
	term: QualitativeTerm
	q: RawPredefinedGroupsetQ
}

export type RawQualTWCustomGS = BaseTW & {
	type?: 'QualTWCustomGS'
	term: QualitativeTerm
	q: RawCustomGroupsetQ
}

export type RawQualTW = RawQualTWValues | RawQualTWPredefinedGS | RawQualTWCustomGS

export type QualitativeBaseQ = MinBaseQ & {
	mode?: 'discrete' | 'binary'
}

export type QualitativeQ = GroupSettingQ | ValuesQ

/**
 * A categorical term wrapper object
 *
 * @group Termdb
 * @category TW
 */

export type QualitativeTW = BaseTW & {
	//id: string
	type: 'QualTWValues' | 'QualTWPredefinedGS' | 'QualTWCustomGS'
	q: QualitativeQ
	term: QualitativeTerm
}

export type QualTWValues = BaseTW & {
	//id: string
	term: QualitativeTerm
	q: ValuesQ
	type: 'QualTWValues'
}

export type QualTWPredefinedGS = BaseTW & {
	//id: string
	term: QualitativeTerm
	q: PredefinedGroupSettingQ
	type: 'QualTWPredefinedGS'
}

export type QualTWCustomGS = BaseTW & {
	//id: string
	term: QualitativeTerm
	q: CustomGroupSettingQ
	type: 'QualTWCustomGS'
}

export type QualTW = QualTWValues | QualTWPredefinedGS | QualTWCustomGS
