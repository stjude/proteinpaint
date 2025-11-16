import type Data from '#plots/disco/data/Data.ts'
import type { InvalidDataInfo } from '#dom'
import type {
	MutationWaterfallDatum,
	MutationWaterfallLogRange
} from '#plots/disco/waterfall/MutationWaterfallDatum.ts'

export interface DataHolder {
	labelData: Array<Data>

	nonExonicSnvData: Array<Data>
	nonExonicInnerRadius: number

	snvRingDataMap: Map<number, Array<Data>>
	snvInnerRadius: number

	snvData: Array<Data>
	bpx: number
	onePxArcAngle: number
	filteredSnvData: Array<Data>

	lohData: Array<Data>
	lohInnerRadius: number

	cnvData: Array<Data>
	cnvInnerRadius: number

	fusionData: Array<Data>
	fusionRadius: number

	hasPrioritizedGenes: boolean
	hasWaterfallEligibleChromosome: boolean

	cnvGainMaxValue?: number
	cnvLossMaxValue?: number
	cappedCnvMaxAbsValue?: number
	percentilePositive?: number
	percentileNegative?: number
	cnvMaxPercentileAbs: number

	lohMaxValue?: number
	lohMinValue?: number

	mutationWaterfallData?: Array<MutationWaterfallDatum>
	mutationWaterfallInnerRadius?: number
	mutationWaterfallLogRange?: MutationWaterfallLogRange

	invalidDataInfo?: InvalidDataInfo
}
