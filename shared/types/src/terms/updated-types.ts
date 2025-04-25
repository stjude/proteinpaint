// temporary code file to hold updated type definitions
// as part of the tw router/handler refactor

import type { CatTWTypes, CategoricalQ } from './categorical.ts'
import type { NumTWTypes, NumericQ } from './numeric.ts'
import type { GvTW, GvQ } from './geneVariant.ts'

export type TermWrapper = CatTWTypes | NumTWTypes | GvTW

export type Q = CategoricalQ | NumericQ | GvQ // | other q
