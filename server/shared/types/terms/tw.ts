import { BaseTW, BaseQ, Term } from './term.ts'
import { CategoricalQ, CategoricalTW } from './categorical.ts'
import { NumericQ, NumericTW } from './numeric.ts'
import { SnpsQ, SnpsTW } from './snps.ts'
import { ConditionQ } from './condition.ts'
import { GeneVariantQ, GeneVariantTerm } from './geneVariant.ts'
import { SampleLstQ } from './samplelst.ts'
import { GeneExpressionTerm } from './geneExpression.js'

export type TermWrapper = CategoricalTW | NumericTW | SnpsTW | (BaseTW & { term: Term; q: Q })
export type TwLst = TermWrapper[]

export type Q = BaseQ | CategoricalQ | ConditionQ | NumericQ | GeneVariantQ | SampleLstQ | SnpsQ
