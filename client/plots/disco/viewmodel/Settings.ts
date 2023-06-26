import { RingType } from '#plots/disco/viewmodel/RingType.ts'

export default interface Settings {
	verticalPadding: number
	horizontalPadding: number

	rings: {
		// ringWidth: 20,
		//
		// cnvCapping: 5,
		// cnvUnit: 'Cnv Unit',
		//
		// snvRingFilters: ['exonic'],
		//
		// nonExonicRingEnabled: true,
		//
		// labelLinesInnerRadius: 210,
		// labelsToLinesDistance: 30,
		// labelsToLinesGap: 2,
		//
		// snvFilterValue: 1,
		// fusionFilterValue: 2,
		// cnvFilterValue: 4,
		//
		// lohFilterValue: 10,
		//
		// displayNonExonic: true,
		// nonExonicFilterValues: ['non-exonic'],

		ringWidth: number

		cnvCapping: number
		cnvUnit: string

		snvRingFilters: Array<string>

		nonExonicRingEnabled: boolean

		chromosomeWidth: number
		chromosomeInnerRadius: number

		labelsToLinesGap: number
		labelsToLinesDistance: number
		labelLinesInnerRadius: number

		snvFilterValue: number
		fusionFilterValue: number
		cnvFilterValue: number
		lohFilterValue: number
		nonExonicFilterValues: Array<string>
	}
	cnv: {
		cappedAmpColor: string
		ampColor: string
		capping: number
		cappedLossColor: string
		lossColor: string
		unit: string
	}
	label: {
		maxDeltaAngle: number
		fontSize: number
		animationDuration: number
		overlapAngleFactor: number
	}
	legend: {
		snvTitle: string
		cnvTitle: string
		lohTitle: string
		fusionTitle: string
		lohLegendEnabled: boolean
		fontSize: number
		rowHeight: number
	}
	padAngle: number
	layerScaler: number
	menu: {
		padding: number
	}
}
