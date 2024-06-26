export default interface Settings {
	verticalPadding: number
	horizontalPadding: number

	downloadImgName: string // file name of downloaded svg

	Disco: {
		cnvCapping: number
		isOpen: boolean
		showPrioritizeGeneLabelsByGeneSets: boolean
		prioritizeGeneLabelsByGeneSets: boolean // set to true to prioritize by default, if applicable
		cnvRenderingType: string
		cnvPercentile: number
	}

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
	snv: {
		maxMutationCount: number
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
