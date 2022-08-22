module.exports = function() {
	return {
		isMds: true,

		cohort: {
			allowedChartTypes: ['barchart', 'survival', 'matrix'],
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
			}
		}
	}
}
