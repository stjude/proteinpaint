import { BaseQ, BaseTW } from './term'
import { CategoricalTerm, CategoricalQ, CategoricalTW } from './categorical.ts'
import { NumericTerm, NumericQ, NumericTW } from './numeric.ts'

export type Term = CategoricalTerm | NumericTerm
export type Q = CategoricalQ | NumericQ | BaseQ
export type TermWrapper = CategoricalTW | NumericTW | (BaseTW & { term: Term; q: Q })
