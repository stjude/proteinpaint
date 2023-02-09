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
				},
				mclass: {
					CNV_amp: {
						color: '#CC0033'
					},
					CNV_loss: {
						color: '#00008b'
					}
				}
			},
			scatterplots: {
				plots: [
					{
						name: 'Methylome TSNE',
						dimension: 2, // 2d requires x/y, 3d requires x/y/z
						file: 'files/hg19/ihg/classification/ihg_oct20_TSNE.txt',
						colorTW: { id: 'Integrated Diagnosis Tier 2' }

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
		},
		assayAvailability: {
			byDt: {
				// snvindel
				1: {
					// mutations are detected from wes
					term_id: 'WES',
					yes: { value: ['Yes', 'Targeted Sequencing'] },
					no: { value: 'ND' }
				},

				// fusion
				2: {
					//mutations are detected from RNAseq
					term_id: 'RNA-Seq',
					yes: { value: ['Yes'] },
					no: { value: ['ND'] }
				},
				// cnv
				4: {
					// mutations are detected from Methylation
					term_id: 'Methylation',
					yes: { value: ['Yes'] },
					no: { value: ['ND'] }
				}
			}
		}
	}
}
