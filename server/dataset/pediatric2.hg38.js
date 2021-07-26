const samplenamekey = 'sample_name'

module.exports = function(common) {
	return {
		genome: 'hg38',
		isMds: true,
		version: {
			label: 'Release v2',
			link: 'https://genomepaint.stjude.cloud/release/v2/'
		},

		gene2mutcount: {
			// to get list of most recurrently mutated genes from a set of samples
			dbfile: 'hg38/Pediatric/genecount.db',
			mutationTypes: [
				{
					db_col: 'snv_mfndi',
					label: 'Missense, frameshift, nonsense, in-frame insertion and deletion mutations',
					default: 1
				},
				{ db_col: 'snv_splice', label: 'Splice site and splice region mutations', default: 1 },
				{ db_col: 'snv_utr', label: "5' and 3' UTR mutations", default: 1 },
				{ db_col: 'snv_s', label: 'Silent mutations', default: 0 },
				{ db_col: 'sv', label: 'SV', default: 1 },
				{ db_col: 'fusion', label: 'Fusion', default: 1 },
				{ db_col: 'itd', label: 'ITD', default: 1 },
				{ db_col: 'cnv_1mb_01', sizecutoff: '1Mb', log2cutoff: 0.1, default: 0 },
				{ db_col: 'cnv_1mb_02', sizecutoff: '1Mb', log2cutoff: 0.2, default: 0 },
				{ db_col: 'cnv_1mb_03', sizecutoff: '1Mb', log2cutoff: 0.3, default: 0 },
				{ db_col: 'cnv_2mb_01', sizecutoff: '2Mb', log2cutoff: 0.1, default: 1 },
				{ db_col: 'cnv_2mb_02', sizecutoff: '2Mb', log2cutoff: 0.2, default: 0 },
				{ db_col: 'cnv_2mb_03', sizecutoff: '2Mb', log2cutoff: 0.3, default: 0 },
				{ db_col: 'cnv_4mb_01', sizecutoff: '4Mb', log2cutoff: 0.1, default: 0 },
				{ db_col: 'cnv_4mb_02', sizecutoff: '4Mb', log2cutoff: 0.2, default: 0 },
				{ db_col: 'cnv_4mb_03', sizecutoff: '4Mb', log2cutoff: 0.3, default: 0 }
			]
		},

		singlesamplemutationjson: {
			file: 'hg38/Pediatric/mutationpersample/table'
		},

		about: [
			{ k: 'Cohort', v: 'PCGP and TARGET' },
			{ k: 'CNV', v: 'Somatic copy number changes' },
			{ k: 'LOH', v: 'Somatic copy-neutral LOH' },
			{ k: 'SV', v: 'Somatic DNA structural variation' },
			{ k: 'Fusion', v: 'Tumor RNA-seq fusion' },
			{ k: 'ITD', v: 'ITD from either RNA or DNA' },
			{ k: 'SNV/indel', v: 'Somatic mutations of tumor, and germline pathogenic mutations' },
			{ k: 'RNA splice junction', v: 'Tumor RNA splice junctions' }
		],

		assayAvailability: {
			file: 'hg19/Pediatric/assayAvailability/sample.by.assay',
			assays: [
				{ id: 'haswgs', name: 'WGS', type: 'categorical', values: { yes: { label: 'yes', color: '#858585' } } },
				{ id: 'hascgi', name: 'CGI', type: 'categorical', values: { yes: { label: 'yes', color: '#858585' } } },
				{ id: 'haswes', name: 'WES', type: 'categorical', values: { yes: { label: 'yes', color: '#858585' } } },
				{ id: 'hassnp6', name: 'SNP6 array', type: 'categorical', values: { yes: { label: 'yes', color: '#858585' } } },
				{
					id: 'hascaptureseq',
					name: 'Capture-seq',
					type: 'categorical',
					values: { yes: { label: 'yes', color: '#858585' } }
				},
				{ id: 'hasrnaseq', name: 'RNA-seq', type: 'categorical', values: { yes: { label: 'yes', color: '#858585' } } },
				{ id: 'hashic', name: 'Hi-C', type: 'categorical', values: { yes: { label: 'yes', color: '#858585' } } }
			]
		},

		/*
		cohort and sample annotation
		*/
		cohort: {
			files: [
				{ file: 'hg19/Pediatric/sampletable/2011_ETP_TALL' },
				{ file: 'hg19/Pediatric/sampletable/2012_AMLM7' },
				{ file: 'hg19/Pediatric/sampletable/2012_hypodiploid_ALL' },
				{ file: 'hg19/Pediatric/sampletable/2012_MB' },
				{ file: 'hg19/Pediatric/sampletable/2012_NBL' },
				{ file: 'hg19/Pediatric/sampletable/2012_RB' },
				{ file: 'hg19/Pediatric/sampletable/2013_E_RHB' },
				{ file: 'hg19/Pediatric/sampletable/2013_LGG' },
				{ file: 'hg19/Pediatric/sampletable/2014_ACT' },
				{ file: 'hg19/Pediatric/sampletable/2014_EPD' },
				{ file: 'hg19/Pediatric/sampletable/2014_EWS' },
				{ file: 'hg19/Pediatric/sampletable/2014_HGG' },
				{ file: 'hg19/Pediatric/sampletable/2014_INF' },
				{ file: 'hg19/Pediatric/sampletable/2014_OS' },
				{ file: 'hg19/Pediatric/sampletable/2014_Pediatric_BALL' },
				{ file: 'hg19/Pediatric/sampletable/2014_Ph-like_ALL' },
				{ file: 'hg19/Pediatric/sampletable/2014_RB' },
				{ file: 'hg19/Pediatric/sampletable/2016_ALL' },
				{ file: 'hg19/Pediatric/sampletable/2016_AML' },
				{ file: 'hg19/Pediatric/sampletable/2020_SCMC' },
				{ file: 'hg19/Pediatric/sampletable/pcgp.target.info' },
				{ file: 'hg19/Pediatric/sampletable/target.samples' },
				{ file: 'hg19/Pediatric/sampletable/target.samples.outcome' },
				{ file: 'hg19/Pediatric/sampletable/target.samples.tallsnp6array' },
				{ file: 'hg19/Pediatric/sampletable/pedccl.celllines' },
				{ file: 'hg19/Pediatric/sampletable/pcgp.telomerecall' },
				{ file: 'hg19/Pediatric/sampletable/pediatric.sampletable' },
				{ file: 'hg19/Pediatric/sampletable/fpkmOnly.samples' },
				{ file: 'hg19/Pediatric/sampletable/2017xenografts.sampletable' }
			],
			samplenamekey: samplenamekey,
			tohash: (item, ds) => {
				const samplename = item[samplenamekey]
				if (!samplename) return console.error(samplenamekey + ' missing from a line: ' + JSON.stringify(item))
				if (ds.cohort.annotation[samplename]) {
					// append info
					for (const k in item) {
						ds.cohort.annotation[samplename][k] = item[k]
					}
				} else {
					// new sample
					ds.cohort.annotation[samplename] = item
				}
			},
			sampleAttribute: {
				attributes: {
					diagnosis_group_short: {
						label: 'Cancer group',
						filter: 1,
						hidden: 1
					},
					diagnosis_short: {
						label: 'Cancer',
						filter: 1
					},
					sample_type: {
						label: 'Sample type',
						filter: 1
					},
					gender: {
						label: 'Gender',
						values: {
							male: { name: 'Male' },
							female: { name: 'Female' }
						}
					},
					race: {
						label: 'Race'
					},
					age_dx_years: {
						label: 'Age at diagnosis'
					},
					'WGS telomere call': {
						label: 'WGS telomere call',
						values: {
							GAIN: { name: 'Gain', color: 'red' },
							LOSS: { name: 'Loss', color: 'blue' },
							NO_CHANGE: { name: 'No change', color: 'gray' }
						}
					},
					'event-free survival (days)': {
						label: 'Event free survival, days',
						isinteger: 1,
						clientnoshow: 1
					},
					'event-free is censored': {
						label: 'Event free survival, censored',
						isinteger: 1,
						clientnoshow: 1
					},
					'overall survival (days)': {
						label: 'Overall survival, days',
						isinteger: 1,
						clientnoshow: 1
					},
					'overall is censored': {
						label: 'Overall survival, censored',
						isinteger: 1,
						clientnoshow: 1
					}
				}
			},

			survivalplot: {
				plots: {
					efs: {
						name: 'Event-free survival',
						serialtimekey: 'event-free survival (days)',
						iscensoredkey: 'event-free is censored',
						timelabel: 'Days'
					},
					os: {
						name: 'Overall survival',
						serialtimekey: 'overall survival (days)',
						iscensoredkey: 'overall is censored',
						timelabel: 'Days'
					}
				},
				samplegroupattrlst: [
					{
						key: 'diagnosis_short'
					}
				]
			},

			mutation_signature: {
				sets: {
					pantargetsignature: {
						name: 'Mutation signature',
						samples: {
							file: 'hg19/TARGET/mutationsignature/sample2signature',
							valuename: 'Number of somatic mutations per MB attributed to each signature',
							skipzero: true
						},
						signatures: {
							1: {
								name: 'Accumulation with age (COSMIC 1)',
								//color: '#1DA850'
								color: '#676767'
							},
							2: {
								name: 'APOBEC 3A/3B (COSMIC 2)',
								color: '#F7ACB4'
							},
							3: {
								name: 'Failure of HR repair (COSMIC 3)',
								//color:'#F7941F',
								color: '#1CA89E' // from 10
							},
							4: {
								name: 'Accumulation with age (COSMIC 5)',
								//color:'#12693A',
								color: '#676767'
							},
							5: {
								name: 'Exposure to UV light (COSMIC 7)',
								color: '#F7EE20'
							},
							6: {
								name: 'Unknown (COSMIC 8)',
								color: '#24A9E0'
							},
							7: {
								name: 'APOBEC 3A/3B + REV1 (COSMIC 13)',
								color: '#F15C47'
							},
							8: {
								name: 'Reactive oxygen species (COSMIC 18)',
								color: '#2C3590'
							},
							9: {
								name: 'MSI signatures (COSMIC 26)',
								color: '#8B603D'
							},
							10: {
								name: 'N/A (COSMIC 23)',
								//color:'#1CA89E',
								color: '#F7941F' // from 3
							},
							11: {
								name: 'N/A (COSMIC 3)',
								color: '#652F90'
							},
							n: {
								nodata: 1,
								color: '#aaa'
							}
						}
					}
				}
			}
		},

		mutationAttribute: {
			attributes: {
				dna_assay: {
					label: 'DNA assay',
					values: {
						cgi: { name: 'CGI', label: 'Complete Genomics whole-genome sequencing' },
						wgs: { name: 'WGS', label: 'Whole-genome sequencing' },
						wes: { name: 'WES', label: 'Whole-exome sequencing' },
						snp6: { name: 'SNP6', label: 'SNP Array 6.0' },
						cc: { name: 'CapVal', label: 'Capture validation' }
					},
					hidden: 1,
					filter: 1
				},
				rna_assay: {
					label: 'RNA assay',
					values: {
						total: { name: 'Total RNA' },
						polya: { name: 'Poly(A)-selected' }
					},
					hidden: 1,
					filter: 1
				},
				project: {
					label: 'Project',
					values: {
						pantarget: { name: 'Pan-TARGET', label: 'Pan-cancer analysis of the NCI TARGET dataset' },
						pcgp: { name: 'PCGP', label: 'Pediatric Cancer Genome Project' },
						scmc: { name: 'SCMC', label: "Shanghai Children's Medical Center pediatric ALL project" },
						pedccl: { name: 'PedCCL', label: 'Pediatric Cancer Cell Lines' }
					},
					filter: 1
				},
				vorigin: {
					label: 'Variant origin',
					values: {
						somatic: { name: 'Somatic' },
						germline: { name: 'Germline' }
					},
					filter: 1
				},
				pmid: {
					label: 'PubMed',
					appendto_link: 'https://pubmed.ncbi.nlm.nih.gov/'
				},
				mutation_signature: {
					label: 'Mutation signature'
				}
			}
		},

		queries: {
			svcnv: {
				name: 'Pediatric tumor mutation',
				istrack: true,
				type: common.tkt.mdssvcnv,
				file: 'hg38/Pediatric/pediatric.svcnv.hg38.gz',

				hideLOHwithCNVoverlap: true,

				// cnv
				valueCutoff: 0.2,
				bplengthUpperLimit: 2000000, // limit cnv length to focal events

				// loh
				segmeanValueCutoff: 0.1,
				lohLengthUpperLimit: 2000000,

				groupsamplebyattr: {
					attrlst: [
						{ k: 'diagnosis_group_short', label: 'Group', full: 'diagnosis_group_full' },
						{ k: 'diagnosis_short', label: 'Cancer', full: 'diagnosis_full' }
					],
					sortgroupby: {
						key: 'diagnosis_group_short',
						order: ['ST', 'BT', 'HM']
					},
					attrnamespacer: ', '
				},

				expressionrank_querykey: 'genefpkm',
				vcf_querykey: 'snvindel',

				multihidelabel_vcf: true,
				multihidelabel_fusion: false,
				multihidelabel_sv: true,

				legend_vorigin: {
					key: 'vorigin',
					somatic: 'somatic',
					germline: 'germline'
				}
			},

			snvindel: {
				hideforthemoment: 1,
				name: 'Pediatric tumor SNV/indel',
				istrack: true,
				type: common.tkt.mdsvcf,
				viewrangeupperlimit: 2000000,
				tracks: [
					{
						file: 'hg38/Pediatric/pediatric.hg38.vcf.gz',
						type: 'vcf'
					}
				]
			},

			genefpkm: {
				hideforthemoment: 1,
				name: 'Pediatric tumor RNA-seq gene FPKM',
				isgenenumeric: true,
				file: 'hg38/Pediatric/pediatric.fpkm.hg38.gz',
				datatype: 'FPKM',

				// for boxplots & circles, and the standalone expression track
				itemcolor: 'green',

				// for expression rank checking when coupled to svcnv
				viewrangeupperlimit: 5000000,

				/*
				one boxplot for each sample group
				the grouping method must be same as svcnv
				*/
				boxplotbysamplegroup: {
					attributes: [
						{ k: 'diagnosis_group_short', label: 'Group', full: 'diagnosis_group_full' },
						{ k: 'diagnosis_short', label: 'Cancer', full: 'diagnosis_full' }
					]
				},

				// yu's data & method for ase/outlier
				ase: {
					qvalue: 0.05,
					meandelta_monoallelic: 0.3,
					asemarkernumber_biallelic: 0,
					//meandelta_biallelic:0.1,  no longer used
					color_noinfo: '#858585',
					color_notsure: '#A8E0B5',
					color_biallelic: '#40859C',
					color_monoallelic: '#d95f02'
				},
				outlier: {
					pvalue: 0.05,
					color: '#FF8875'
				}
			}
		}
	}
}
