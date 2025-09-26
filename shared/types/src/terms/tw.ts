import type { SnpsQ, SnpsTW } from './snps.ts'
import type { ConditionQ, ConditionTW } from './condition.ts'
import type { SampleLstQ } from './samplelst.ts'
import type { CatTWTypes, CategoricalQ } from './categorical.ts'
import type { NumTW, NumericQ } from './numeric.ts'
import type { GvTW, GvQ } from './geneVariant.ts'
import type { QualTW, QualQ } from './qualitative.ts'

export type BaseTW = {
	id?: string
	$id?: string
	isAtomic?: true
	// plot-specific customizations that are applied to a tw copy
	// todo: should rethink these
	legend?: any
	settings?: {
		[key: string]: any
	}
	sortSamples?: any
	minNumSamples?: number
	valueFilter?: any
}

export type TermWrapper = CatTWTypes | NumTW | GvTW | ConditionTW | SnpsTW | QualTW

export type Q = CategoricalQ | NumericQ | GvQ | ConditionQ | SnpsQ | SampleLstQ | QualQ // | other q

//export type TermWrapper = CategoricalTW | NumericTW | SnpsTW | (BaseTW & { term: Term; q: Q })
export type TwLst = TermWrapper[]

//export type Q = BaseQ | CategoricalQ | ConditionQ | NumericQ | SampleLstQ | SnpsQ

export type RawTW =
	//{ id: string } | RawCatTW
	//
	// BELOW TYPE IS NOT TESTED, only being used to compare tsc type checking behavior
	// between non-union versus type-unions, which way is easier to code against
	{
		id?: string
		term?: {
			type: 'categorical' | 'condition'
			[key: string | number]: any
		}
		q?: {
			//predefined_groupset_idx?: number
			//customset?: any
			[key: string]: any
			//type?: string //'custom-groupset' |
			//customset?: any
		}
		isAtomic?: true
		$id?: string
	}

export interface TwHandler {
	render?: (opts?: any) => void
}
