module.exports = function() {
	return {
		isMds3: true,

		cohort: {
			allowedChartTypes: ['barchart', 'survival', 'matrix', 'sampleScatter'],
			mutationset: [
				{
					snvindel: 'sdhanda/mb_portal/BT_database/SNVindel_pnet.tsv',
					cnv: 'sdhanda/mb_portal/BT_database/CNV_data_pnet.tsv',
					fusion: 'sdhanda/mb_portal/BT_database/fusion_pnet.tsv'
				}
			],
			db: {
				file: 'files/hg19/pnet/clinical/db'
			},
			termdb: {
				allowedTermTypes: ['geneVariant']
			},
			scatterplots: {
				plots: [
					{
						name: 'Methylome TSNE with Age Group',
						dimension: 2, // 2d requires x/y, 3d requires x/y/z
						file: 'files/hg19/pnet/classification/pnet_apr13_tnse.txt',
						colorTW: { id: 'TSNE Category' },
						shapeTW: { id: 'Age Group' }
						// allow additional config for this plot
						// allow additional config for this plot
					},
					{
						name: 'Methylome TSNE',
						dimension: 2, // 2d requires x/y, 3d requires x/y/z
						file: 'files/hg19/pnet/classification/pnet_apr13_tnse.txt',
						colorTW: { id: 'TSNE Category' }
						// allow additional config for this plot
						// allow additional config for this plot
					}
				]
			}
		}
	}
}
