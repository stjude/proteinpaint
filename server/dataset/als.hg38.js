const clinvar = require('./clinvar')

// update format of clinical significance categories
for (const category in clinvar.clinsig) {
	const properties = clinvar.clinsig[category]
	properties.name = properties.label
	delete properties.label
	if (properties.textcolor) delete properties.textcolor
}

const samplenamekey = 'sample_name'

module.exports = function(common) {
	return {
		isMds: true,

		about: [],

		sampleAssayTrack: {
			file: 'hg38/als/mds/assaytracks/track.table'
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
					ClinDx_WGS: {
						label: 'Clinical diagnosis',
						filter: 1
					},
					Sex_c: {
						label: 'Sex',
						filter: 1
					},
					OsAge: {
						label: 'Age at onset (in years)',
						isinteger: 1,
						filter: 0
					},
					SurvOs_mo: {
						label: 'Survival from onset (in months)',
						isfloat: 1,
						filter: 0
					}
				}
			}
		},

		locusAttribute: {
			attributes: {
				CLNSIG: {
					label: 'Clinical significance',
					filter: 1,
					values: clinvar.clinsig
				}
			}
		},

		alleleAttribute: {
			attributes: {
				CADD_phred: {
					label: 'CADD phred',
					isnumeric: 1,
					filter: 1
				},
				REVEL_score: {
					label: 'REVEL score',
					isnumeric: 1,
					filter: 1
				},
				AF: {
					label: 'Cohort allele frequency',
					isnumeric: 1,
					filter: 1
				},
				AF_only_HSP: {
					label: 'Cohort allele frequency (only HSP)',
					isnumeric: 1,
					filter: 1
				},
				AF_only_ALS: {
					label: 'Cohort allele frequency (only ALS)',
					isnumeric: 1,
					filter: 1
				},
				gnomad30_genome_AF: {
					label: 'gnomAD v3 allele frequency',
					isnumeric: 1,
					filter: 1
				},
				gnomad30_genome_AF_afr: {
					label: 'gnomAD v3 allele frequency - African/African American',
					isnumeric: 1,
					filter: 1
				},
				gnomad30_genome_AF_ami: {
					label: 'gnomAD v3 allele frequency - Amish',
					isnumeric: 1,
					filter: 1
				},
				gnomad30_genome_AF_amr: {
					label: 'gnomAD v3 allele frequency - American Admixed/Latino',
					isnumeric: 1,
					filter: 1
				},
				gnomad30_genome_AF_asj: {
					label: 'gnomAD v3 allele frequency - Ashkenazi Jewish',
					isnumeric: 1,
					filter: 1
				},
				gnomad30_genome_AF_eas: {
					label: 'gnomAD v3 allele frequency - East Asian',
					isnumeric: 1,
					filter: 1
				},
				gnomad30_genome_AF_fin: {
					label: 'gnomAD v3 allele frequency - Finnish',
					isnumeric: 1,
					filter: 1
				},
				gnomad30_genome_AF_nfe: {
					label: 'gnomAD v3 allele frequency - Non-Finnish European',
					isnumeric: 1,
					filter: 1
				},
				gnomad30_genome_AF_sas: {
					label: 'gnomAD v3 allele frequency - South Asian',
					isnumeric: 1,
					filter: 1
				},
				gnomad30_genome_AF_oth: {
					label: 'gnomAD v3 allele frequency - Other',
					isnumeric: 1,
					filter: 1
				}
			}
		},

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
				file: 'hg38/als/mds/vcf/GenomePaint_CNV_705_samples_CReATe_ALS_2022Mar7.sorted.txt.gz',

				// cnv
				valueCutoff: 0.2,
				bplengthUpperLimit: 2000000, // limit cnv length to focal events

				vcf_querykey: 'snvindel',

				multihidelabel_vcf: false,
				multihidelabel_sv: true

				//no_loh: true
			},

			snvindel: {
				name: 'CReATe ALS SNV/indel',
				istrack: true,
				type: common.tkt.mdsvcf,
				viewrangeupperlimit: 2000000,
				tracks: [
					{
						file: 'hg38/als/mds/vcf/CReATe_gatk4.1.8.0_hg38_multianno.705_2021Oct22.vepanno.with-ALS-HSP-AF.vcf.gz',
						type: 'vcf'
					}
				]
			}
		}
	}
}
