import { BaseTW, BaseQ, Term } from './term.ts'
import { CategoricalQ, CategoricalTW, RawCatTW } from './categorical.ts'
import { NumericQ, NumericTW } from './numeric.ts'
import { SnpsQ, SnpsTW } from './snps.ts'
import { ConditionQ } from './condition.ts'
import { GeneVariantQ } from './geneVariant.ts'
import { SampleLstQ } from './samplelst.ts'

export type TermWrapper = CategoricalTW //| NumericTW | SnpsTW | (BaseTW & { term: Term; q: Q })
export type TwLst = TermWrapper[]

export type Q = BaseQ | CategoricalQ | ConditionQ | NumericQ | GeneVariantQ | SampleLstQ | SnpsQ

export type RawTW = RawCatTW
