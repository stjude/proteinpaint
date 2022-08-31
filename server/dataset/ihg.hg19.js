module.exports = function() {
	return {
		isMds: true,

		cohort: {
			allowedChartTypes: ['barchart', 'survival', 'matrix'],
			mutationset: [
				{
					snvindel: 'sdhanda/mb_portal/BT_database/SNVindel_IHG.tsv',
					cnv: 'sdhanda/mb_portal/BT_database/CNV_data_IHG.tsv',
					fusion: 'sdhanda/mb_portal/BT_database/fusion_IHG.tsv'
				}
			],
			db: {
				file: 'files/hg19/pnet/clinical/db'
			},
			termdb: {
				allowedTermTypes: ['geneVariant']
			}
		}
	}
}
