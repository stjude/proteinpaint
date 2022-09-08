module.exports = function() {
	return {
		isMds: true,

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
				plot: [
					// {
					// 	name: 'Methylome UMAP',
					// 	dimensions: 2,
					// 	file: 'path/to/methylomeUmap.txt'
					// 	// file columns:
					// 	// column 1: sample id (later: use string name if the sample is DKFZ but not neuroOnc)
					// 	// column 2/3: x/y
					// 	// allow additional config for this plot
					// },
					{
						name: 'Methylome TSNE',
						dimension: 2, // 2d requires x/y, 3d requires x/y/z
						file: 'files/hg19/pnet/classification/methylome_tsne.txt'
						// allow additional config for this plot
					}
					// {
					// 	name: 'RNAseq tSNE',
					// 	dimension: 2, // 2d requires x/y, 3d requires x/y/z
					// 	file: 'path/to/transcriptomeTsne.txt'
					// 	// allow additional config for this plot
					// }
				]
			}
		}
	}
}
