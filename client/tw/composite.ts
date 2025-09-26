import type { QualTW, NumTWDiscreteTypes, NumTWCont } from '#types'
import type { QualValues, QualPredefinedGS, QualCustomGS } from './qualitative'
import type { NumRegularBin, NumCustomBins, NumCont } from './numeric'

export type DiscreteTW = QualTW | NumTWDiscreteTypes
export type DiscreteXTW = QualValues | QualPredefinedGS | QualCustomGS | NumRegularBin | NumCustomBins
export type ContinuousTW = NumTWCont
export type ContinuousXTW = NumCont
