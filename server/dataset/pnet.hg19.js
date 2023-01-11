module.exports = {
	isMds3: true,

	cohort: {
		allowedChartTypes: ['summary', 'survival', 'matrix', 'sampleScatter'],
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
					name: 'Methylome TSNE',
					dimension: 2, // 2d requires x/y, 3d requires x/y/z
					file: 'files/hg19/pnet/classification/pnet_apr13_tnse.txt',
					colorTW: { id: 'TSNE Category' }
				}
			]
		}
	},

	assayAvailability: {
		byDt: {
			// // snvindel
			// 1: {
			// 	// mutations are detected from wes
			// 	term_id: 'WES',
			// 	yes: { value: 'Yes' },
			// 	no: { value: 'No' } //, label: 'Not tested', color: '#fff'
			// },

			// snvindel, differentiating sample origin
			1: {
				byOrigin: {
					G: {
						term_id: 'Germline',
						yes: { value: 'Yes' },
						no: { value: 'No' }
					},
					S: {
						term_id: 'WES',
						yes: { value: 'Yes' },
						no: { value: 'No' }
					}
				}
			},

			// fusion
			2: {
				//mutations are detected from RNAseq
				term_id: 'RNAseq',
				yes: { value: 'Yes' },
				no: { value: 'No' }
			},
			// cnv
			4: {
				// mutations are detected from Methylation
				term_id: 'Methylation',
				yes: { value: 'Yes' },
				no: { value: 'No' }
			}
		}
	}
}
