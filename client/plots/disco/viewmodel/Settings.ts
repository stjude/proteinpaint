import { RingType } from '#plots/disco/viewmodel/RingType.ts'

export default interface Settings {
	verticalPadding: number
	horizontalPadding: number

	rings: {
		order: Array<RingType>

		width: number

		fusionRadius: number

		cnvInnerRadius: number

		cnvWidth: number
		cnvCapping: number
		cnvUnit: string

		lohWidth: number
		lohInnerRadius: number

		svnInnerRadius: number
		svnWidth: number
		snvRingFilter: string

		nonExonicInnerRadius: number
		nonExonicWidht: number
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
		nonExonicFilterValue: string
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
