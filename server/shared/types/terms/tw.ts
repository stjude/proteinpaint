import { BaseTW } from './term.ts'
import { BaseQ } from 'termdb.ts'
import { CategoricalTerm, CategoricalQ, CategoricalTW } from './categorical.ts'
import { NumericTerm, NumericQ, NumericTW } from './numeric.ts'
import { SnpsTerm, SnpsQ, SnpsTW } from './snps.ts'
import { ConditionQ } from './terms/condition.ts'
import { GeneVariantQ } from './terms/geneVariant.ts'
import { SampleLstQ } from './terms/samplelst.ts'
import { Term } from './terms/tw.ts'

export type Term = CategoricalTerm | NumericTerm | SnpsTerm
export type TermWrapper = CategoricalTW | NumericTW | SnpsTW | (BaseTW & { term: Term; q: Q })
export type TwLst = TermWrapper[]

export type Q = BaseQ | CategoricalQ | ConditionQ | NumericQ | GeneVariantQ | SampleLstQ | SnpsQ
