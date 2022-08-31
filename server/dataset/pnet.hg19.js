module.exports = function() {
	return {
		isMds: true,

		cohort: {
			allowedChartTypes: ['barchart', 'survival', 'matrix'],
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
			}
		}
	}
}
