const samplenamekey = 'sample_name'

module.exports = function(common) {
	return {
		isMds: true,

		about: [],

		sampleAssayTrack: {
			file: 'hg38/scd/mds/assaytracks/__table'
		},

		cohort: {
			files: [
				// possible to have file-specific logic
				{ file: 'hg38/scd/mds/sample.table' }
			],
			samplenamekey: samplenamekey,
			tohash: (item, ds) => {
				const n = item[samplenamekey]
				if (ds.cohort.annotation[n]) {
					for (const k in item) {
						ds.cohort.annotation[n][k] = item[k]
					}
				} else {
					ds.cohort.annotation[n] = item
				}
			},
			sampleAttribute: {
				attributes: {
					CorrectedHbF: {
						label: 'HbF level',
						isfloat: true,
						showintrack: true
					}
				}
			}
		},

		mutationAttribute: {
			attributes: {
				discordantreads: {
					label: 'Discordant read pairs'
				}
			}
		},

		queries: {
			svcnv: {
				name: 'SCD germline CNV',
				showfullmode: true,
				istrack: true,
				type: common.tkt.mdssvcnv,
				file: 'hg38/scd/mds/cnv.gz',

				// cnv
				valueCutoff: 0.2,
				bplengthUpperLimit: 2000000, // limit cnv length to focal events

				/*
				to sort sample groups consistently, on client, not on server
				*/

				multihidelabel_vcf: false,
				multihidelabel_sv: true
			}
		}
	}
}
