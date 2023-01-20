module.exports = function() {
	return {
		isMds3: true,

		cohort: {
			allowedChartTypes: ['summary', 'survival', 'matrix', 'sampleScatter'],
			mutationset: [
				{
					snvindel: 'sdhanda/mb_portal/BT_database/SNVindel_IHG.tsv',
					cnv: 'sdhanda/mb_portal/BT_database/CNV_data_IHG.tsv',
					fusion: 'sdhanda/mb_portal/BT_database/fusion_IHG.tsv'
				}
			],
			db: {
				file: 'files/hg19/ihg/clinical/db'
			},
			termdb: {
				allowedTermTypes: ['geneVariant'],
				multipleTestingCorrection: {
					method: 'bon',
					skipLowSampleSize: true
				}
			},
			scatterplots: {
				plots: [
					{
						name: 'Methylome TSNE',
						dimension: 2, // 2d requires x/y, 3d requires x/y/z
						file: 'files/hg19/ihg/classification/ihg_oct20_TSNE.txt',
						colorTW: { id: 'Integrated DiagnosisTier 2 ' }

						// allow additional config for this plot
						// allow additional config for this plot
					}
				]
			},
			matrixplots: {
				plots: [
					{
						name: 'Matrix plot',
						file: 'files/hg19/ihg/classification/matrixPlot_ihg.json'
					}
				]
			}
		}
	}
}
