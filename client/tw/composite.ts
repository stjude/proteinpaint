import type { CatTWTypes, NumTWDiscreteTypes, NumTWCont } from '#types'
import type { CatValues, CatPredefinedGS, CatCustomGS } from './categorical'
import type { NumRegularBin, NumCustomBins, NumCont } from './numeric'

export type DiscreteTW = CatTWTypes | NumTWDiscreteTypes
export type DiscreteXTW = CatValues | CatPredefinedGS | CatCustomGS | NumRegularBin | NumCustomBins
export type ContinuousTW = NumTWCont
export type ContinuousXTW = NumCont
