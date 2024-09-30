import type { CatTWTypes, NumTWDiscreteTypes, NumTWCont } from '#types'
import { CatValues, CatPredefinedGS, CatCustomGS } from './categorical'
import { NumRegularBin, NumCustomBins, NumCont } from './numeric'

export type DiscreteTW = CatTWTypes | NumTWDiscreteTypes
export type DiscreteXTW = CatValues | CatPredefinedGS | CatCustomGS | NumRegularBin | NumCustomBins
export type ContinuousTW = NumTWCont
export type ContinuousXTW = NumCont
