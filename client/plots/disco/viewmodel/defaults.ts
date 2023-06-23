import Settings from './Settings'

export default function discoDefaults(overrides = {}): Settings {
	return Object.assign(
		{
			rings: {
				fusionRadius: 80,

				cnvInnerRadius: 100,
				cnvWidth: 20,
				cnvCapping: 5,
				cnvUnit: 'Cnv Unit',

				lohInnerRadius: 120,
				lohWidth: 20,

				svnInnerRadius: 140,
				svnWidth: 20,
				snvRingFilter: 'exonic',

				nonExonicInnerRadius: 160,
				nonExonicWidht: 30,
				nonExonicRingEnabled: false,

				chromosomeInnerRadius: 190,
				chromosomeWidth: 20,

				labelLinesInnerRadius: 210,
				labelsToLinesDistance: 30,
				labelsToLinesGap: 2,

				snvFilterValue: 1,
				fusionFilterValue: 2,
				cnvFilterValue: 4,

				lohFilterValue: 10,

				nonExonicFilterValue: 'non-exonic',
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
			},

			cnv: {
				capping: 5,
				ampColor: '#D6683C',
				lossColor: '#67a9cf',
				cappedAmpColor: '#8B0000',
				cappedLossColor: '#00008B',
				unit: 'Unit',
			},
			legend: {
				snvTitle: 'SNV',
				cnvTitle: 'CNV',
				lohTitle: 'LOH',
				fusionTitle: 'SV', // Structural Variants (color by co-location)
				lohLegendEnabled: true,
				fontSize: 12,
				rowHeight: 40,
			},

			menu: {
				padding: 5,
			},
		},
		overrides
	)
}
