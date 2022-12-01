module.exports = function() {
	return {
		isMds3: true,

		cohort: {
			allowedChartTypes: ['summary', 'survival', 'matrix', 'sampleScatter'],
			mutationset: [
				{
					snvindel:
						'sdhanda/mb_portal/BT_database/MB03_meta_analysis/data_jan7_2022/Metadata/Alterations/snv_indel1.tsv',
					cnv: 'sdhanda/mb_portal/BT_database/MB03_meta_analysis/data_jan7_2022/Metadata/Alterations/cnv_focal1.tsv'
				}
			],
			db: {
				file: 'files/hg38/mbmeta/clinical/db'
			},
			termdb: {
				allowedTermTypes: ['geneVariant']
			},
			scatterplots: {
				plots: [
					{
						name: 'Methylome TSNE',
						dimension: 2, // 2d requires x/y, 3d requires x/y/z
						file: 'files/hg38/mbmeta/classification/meta_analysis_coordinates.txt',
						colorTW: { id: 'Subgroup' }

						// allow additional config for this plot
						// allow additional config for this plot
					}
				]
			}
		}
	}
}
