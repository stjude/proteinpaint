const samplenamekey = 'sample_name'

module.exports = function(common) {
	return {
		isMds: true,

		about: [],

		sampleAssayTrack: {
			file: 'hg38/als/mds/assaytracks/__table'
		},

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
					ALSRD_Dx: {
						label: 'ALSRD_Dx',
						filter: 1
					}
				}
			}
		},

		locusAttribute: {
			// FIXME
			attributes: {
				CLNSIG: {
					label: 'Clinical significance',
					filter: 1,
					values: {}
				}
			}
		},

		alleleAttribute: {
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
				name: 'ALS germline mutation',

				//showfullmode:true,

				istrack: true,
				type: common.tkt.mdssvcnv,
				file: 'hg38/als/mds/svcnv.gz',

				// cnv
				valueCutoff: 0.2,
				bplengthUpperLimit: 2000000, // limit cnv length to focal events

				groupsamplebyattr: {
					attrlst: [{ k: 'ALSRD_Dx', label: 'ALSRD_Dx' }],
					sortgroupby: {
						key: 'ALSRD_Dx',
						order: ['ALS', 'ALS-FTD', 'FTD', 'HSP (complicated)', 'HSP (pure)', 'PLS', 'PMA']
					},
					attrnamespacer: ', '
				},

				vcf_querykey: 'snvindel',

				multihidelabel_vcf: false,
				multihidelabel_sv: true,

				no_loh: true
			},

			snvindel: {
				name: 'ALS germline SNV/indel',
				istrack: true,
				type: common.tkt.mdsvcf,
				viewrangeupperlimit: 2000000,
				tracks: [
					{
						file: 'hg38/als/mds/vcf/ALS329.vep.ann.hg38_multianno.clinvar.ExAC.NFE.vcf.gz',
						type: 'vcf',
						samplenameconvert: str => {
							return str.split('-')[0]
						}
					}
				]
			}
		}
	}
}
