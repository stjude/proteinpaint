export default interface Settings {
	verticalPadding: number
	horizontalPadding: number

	rings: {
		snvRingFilters: Array<string>

		nonExonicRingEnabled: boolean

		chromosomeWidth: number
		chromosomeInnerRadius: number

		nonExonicRingWidth: number
		snvRingWidth: number
		lohRingWidth: number
		cnvRingWidth: number

		labelsToLinesGap: number
		labelsToLinesDistance: number
		labelLinesInnerRadius: number

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
		showPrioritizeCancerGenes: boolean
		prioritizeCancerGenes: boolean
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
