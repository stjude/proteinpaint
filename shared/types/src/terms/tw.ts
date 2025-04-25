import type { BaseQ, BaseTW, Term } from './term.ts'
import type { CategoricalQ, CategoricalTW } from './categorical.ts'
import type { NumericQ, NumericTW } from './numeric.ts'
import type { SnpsQ, SnpsTW } from './snps.ts'
import type { ConditionQ } from './condition.ts'
import type { GvQ, GvTW } from './geneVariant.ts'
import type { SampleLstQ } from './samplelst.ts'

export type TermWrapper = CategoricalTW | NumericTW | GvTW | SnpsTW | (BaseTW & { term: Term; q: Q })
export type TwLst = TermWrapper[]

export type Q = BaseQ | CategoricalQ | ConditionQ | NumericQ | GvQ | SampleLstQ | SnpsQ

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
