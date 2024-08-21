import { BaseQ } from './term.ts'
import { CategoricalQ, CategoricalTW } from './categorical.ts'
import { NumericQ /*, NumericTW*/ } from './numeric.ts'
import { SnpsQ /*, SnpsTW*/ } from './snps.ts'
import { ConditionQ } from './condition.ts'
import { GeneVariantQ } from './geneVariant.ts'
import { SampleLstQ } from './samplelst.ts'

export type TermWrapper = CategoricalTW //| NumericTW | SnpsTW | (BaseTW & { term: Term; q: Q })
export type TwLst = TermWrapper[]

export type Q = BaseQ | CategoricalQ | ConditionQ | NumericQ | GeneVariantQ | SampleLstQ | SnpsQ

export type RawTW =
	//{ id: string } | RawCatTW
	{
		id?: string
		term?: {
			//type: 'categorical' | 'condition'
			[key: string | number]: any
		}
		q?: {
			//predefined_groupset_idx?: number
			//customset?: any
			[key: string]: any
			type?: string //'custom-groupset' |
			customset?: any
		}
		isAtomic?: true
		$id?: string
	}

export interface TwHandler {
	render?: (opts?: any) => void
}

export type HandlerOpts = {
	vocabApi?: any // TODO
	//usecase?: any
	defaultQ?: any
	base?: any
	root?: any
	clsMap?: {
		CategoricalValues?: TwHandler
		CategoricalPredefinedGS?: TwHandler
		CategoricalCustomGS?: TwHandler
	}
}
