module.exports = function() {
	return {
		isMds: true,

		cohort: {
			allowedChartTypes: ['summary', 'matrix'],
			mutationset: [
				{
					snvindel: 'sdhanda/mb_portal/BT_database/mb_review/SNVindel_firstcase.tsv',
					cnv: 'sdhanda/mb_portal/BT_database/mb_review/CNV_data_firstcase.tsv',
					fusion: 'sdhanda/mb_portal/BT_database/mb_review/fusion_firstcase.tsv'
				}
			],
			db: {
				file: 'files/hg38/mbunder6/clinical/db'
			},
			termdb: {
				allowedTermTypes: ['geneVariant'],
				multipleTestingCorrection: {
					method: 'bon',
					skipLowSampleSize: true
				}
			}
		}
	}
}
