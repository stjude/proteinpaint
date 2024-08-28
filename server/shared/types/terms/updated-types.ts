// temporary code file to hold updated type definitions
// as part of the tw router/handler refactor

import { CatTWTypes, CategoricalQ } from './categorical.ts'
import { NumericTWTypes, NumericQ } from './numeric.ts'

export type TermWrapper = CatTWTypes | NumericTWTypes

export type Q = CategoricalQ | NumericQ // | other q
