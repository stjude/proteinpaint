export default interface Settings {
	verticalPadding: number
	horizontalPadding: number

	downloadImgName: string // file name of downloaded svg

	Disco: {
		/** Global radius controlling ring size */
		radius?: number
		/** Opacity of the fusion arcs */
		fusionOpacity?: number
		centerText: string
		cnvCapping: number
		isOpen: boolean
		showPrioritizeGeneLabelsByGeneSets: boolean
		prioritizeGeneLabelsByGeneSets: boolean // set to true to prioritize by default, if applicable
		cnvRenderingType: string
		cnvPercentile: number
		/** auto, fixed, percentile. Used for the numeric inputs dropdown
		 * for cnv color scales. */
		cnvCutoffMode: string
		/** Chromosomes not rendered */
		hiddenChromosomes: string[]
		mutationWaterfallPlot: boolean
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
		mutationWaterfallRingWidth: number

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
		/** Immutable default. User changes settings.Disco.cnvCapping.
		 * Used when reseting plot to default cnv values. */
		capping: number
		/** Immutable default. User changes settings.Disco.cnvPercentile.
		 * Used when reseting plot to default cnv values. */
		percentile: number
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
