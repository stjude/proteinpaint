import Settings from './Settings'
import { copyMerge } from '#rx'

export default function discoDefaults(overrides = {}): Settings {
	const defaults = {
		downloadImgName: 'disco.plot',

		rings: {
			nonExonicRingWidth: 20,
			snvRingWidth: 20,
			lohRingWidth: 20,
			cnvRingWidth: 30,

			snvRingFilters: ['exonic'],

			chromosomeInnerRadius: 190,
			chromosomeWidth: 20,

			labelLinesInnerRadius: 210,
			labelsToLinesDistance: 30,
			labelsToLinesGap: 2,

			nonExonicRingEnabled: true,
			nonExonicFilterValues: ['non-exonic']
		},

		verticalPadding: 70,
		horizontalPadding: 500,

		layerScaler: 1,
		padAngle: 0.002, //0.01, //0.04,

		label: {
			fontSize: 12,
			maxDeltaAngle: 0.05,
			animationDuration: 1000,
			overlapAngleFactor: 5, // 5 is set by testing, because label height is not known before rendering
			prioritizeGeneLabelsByGeneSets: false,
			showPrioritizeGeneLabelsByGeneSets: false
		},

		cnv: {
			capping: 5,
			ampColor: '#D6683C',
			lossColor: '#67a9cf',
			cappedAmpColor: '#8B0000',
			cappedLossColor: '#00008B',
			unit: 'Unit'
		},
		snv: {
			maxMutationCount: 10000
		},
		legend: {
			snvTitle: 'SNV',
			cnvTitle: 'CNV',
			lohTitle: 'LOH',
			fusionTitle: 'SV', // Structural Variants (color by co-location)
			lohLegendEnabled: true,
			fontSize: 12,
			rowHeight: 48
		},

		menu: {
			padding: 5
		}
	}

	return copyMerge(defaults, overrides)
}
