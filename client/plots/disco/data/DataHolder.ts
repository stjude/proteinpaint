import Data from '#plots/disco/data/Data.ts'

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

	prioritizeGeneLabelsByGeneSets: boolean

	cnvMaxValue?: number
	cnvMinValue?: number

	lohMaxValue?: number
	lohMinValue?: number
}
