const samplenamekey = 'sample_name'

module.exports = function(common) {
	return {
		isMds: true,

		about: [],

		/*sampleAssayTrack: {
			file: 'hg38/als/mds/assaytracks/__table'
		},*/

		cohort: {
			files: [{ file: 'hg38/als/mds/sample.table' }],
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
					Batch: {
						label: 'Batch',
						filter: 1,
						hidden: 1
					},
					ClinDx_WGS: {
						label: 'ClinDx_WGS',
						filter: 1
					},
					Sex_c: {
						label: 'Sex_c',
						filter: 1
					},
					OsAge: {
						label: 'OsAge',
						filter: 1,
						hidden: 1
					},
					SurvOs_mo: {
						label: 'SurvOs_mo',
						filter: 1,
						hidden: 1
					}
				}
			}
		},

		/*locusAttribute: {
			// FIXME
			attributes: {
				CLNSIG: {
					label: 'Clinical significance',
					filter: 1,
					values: {}
				}
			}
		},*/

		/*alleleAttribute: {
			attributes: {
				ExAC_AF: {
					label: 'ExAC',
					isnumeric: 1,
					filter: 1,
					cutoffvalue: 0.01,
					keeplowerthan: true
				},
				AF: {
					label: 'AF',
					isnumeric: 1,
					filter: 1,
					cutoffvalue: 0.01,
					keeplowerthan: true
				},
				CADD_phred: {
					label: 'CADD_phred',
					filter: 1,
					isnumeric: 1,
					cutoffvalue: 10
				}
			}
		},*/

		/*mutationAttribute: {
			attributes: {
				discordantreads: {
					label: 'Discordant read pairs'
				}
			}
		},*/

		queries: {
			svcnv: {
				name: 'CReATe ALS mutation',

				//showfullmode:true,

				istrack: true,
				type: common.tkt.mdssvcnv,
				file: 'hg38/als/mds/svcnv.gz',

				// cnv
				valueCutoff: 0.2,
				bplengthUpperLimit: 2000000, // limit cnv length to focal events

				vcf_querykey: 'snvindel',

				multihidelabel_vcf: false,
				multihidelabel_sv: true,

				no_loh: true
			},

			snvindel: {
				name: 'CReATe ALS SNV/indel',
				istrack: true,
				type: common.tkt.mdsvcf,
				viewrangeupperlimit: 2000000,
				tracks: [
					{
						file: 'hg38/als/mds/vcf/CReATe_gatk4.1.8.0_hg38_multianno.705_2021Oct22.vepanno.vcf.gz',
						type: 'vcf'
					}
				]
			}
		}
	}
}
