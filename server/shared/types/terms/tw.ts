import { BaseQ, BaseTW } from './term'
import { CategoricalTerm, CategoricalQ, CategoricalTW } from './categorical.ts'
import { NumericTerm, NumericQ, NumericTW } from './numeric.ts'
import { SnpsTerm, SnpsQ, SnpsTW } from './snps.ts'

export type Term = CategoricalTerm | NumericTerm | SnpsTerm
export type Q = CategoricalQ | NumericQ | BaseQ | SnpsQ
export type TermWrapper = CategoricalTW | NumericTW | SnpsTW | (BaseTW & { term: Term; q: Q })
