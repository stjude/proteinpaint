import { BaseQ, BaseTW } from './term'
import { CategoricalTerm, CategoricalQ, CategoricalTW } from './categorical'
import { NumericTerm, NumericQ, NumericTW } from './numeric'
import { SnpsTerm, SnpsQ, SnpsTW } from './snps'

export type Term = CategoricalTerm | NumericTerm | SnpsTerm
export type Q = CategoricalQ | NumericQ | BaseQ | SnpsQ
export type TermWrapper = CategoricalTW | NumericTW | SnpsTW | (BaseTW & { term: Term; q: Q })
export type TwLst = TermWrapper[]
