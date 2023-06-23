import Settings from './Settings'
import { RingType } from '#plots/disco/viewmodel/RingType.ts'

export default function discoDefaults(overrides = {}): Settings {
	return Object.assign(
		{
			rings: {
				order: [
					RingType.FUSION,
					RingType.CNV,
					RingType.LOH,
					RingType.SNV,
					RingType.NONEXONICSNV,
					// RingType.CHROMOSOME,
					// RingType.LABEL
				],

				dimensions: [
					{
						radius: 80, //	fusionRadius: 80,
						width: undefined,
					},
					{
						radius: 100, //	cnvInnerRadius: 80,
						width: 20,
					},
					{
						radius: 120, // lohInnerRadius: 120,
						width: 20,
					},
					{
						radius: 140, // svnInnerRadius: 140,
						width: 20,
					},
					{
						radius: 140, // svnInnerRadius: 140,
						width: 20,
					},
					{
						radius: 160, // nonExonicInnerRadius: 140,
						width: 20,
					},
				],

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
