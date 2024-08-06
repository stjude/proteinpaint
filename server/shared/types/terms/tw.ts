import { BaseTW, BaseQ, Term } from './term'
import { CategoricalQ, CategoricalTW } from './categorical'
import { NumericQ, NumericTW } from './numeric'
import { SnpsQ, SnpsTW } from './snps'
import { ConditionQ } from './condition'
import { GeneVariantQ } from './geneVariant'
import { SampleLstQ } from './samplelst'

export type TermWrapper = CategoricalTW | NumericTW | SnpsTW | (BaseTW & { term: Term; q: Q })
export type TwLst = TermWrapper[]

export type Q = BaseQ | CategoricalQ | ConditionQ | NumericQ | GeneVariantQ | SampleLstQ | SnpsQ
