const valuePerSample = {
	key: 'percentage',
	label: 'Percentage',
	cutoffValueLst: [
		{ side: '>', value: 5, label: '>5%' },
		{ side: '>', value: 10, label: '>10%' },
		{ side: '>', value: 20, label: '>20%' },
		{ side: '>', value: 30, label: '>30%' },
		{ side: '>', value: 40, label: '>40%' }
	]
}

const samplenamekey = 'sample_name'

module.exports = {
	genome: 'hg19',
	isMds: true,
	version: {
		label: 'Release v3',
		link: 'https://genomepaint.stjude.cloud/release/v3/'
	},

	sampleAssayTrack: {
		file: 'hg19/Pediatric/tracktable/__table'
	},

	singlesamplemutationjson: {
		file: 'hg19/Pediatric/mutationpersample/table'
	},

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
			// not using "hasrnaseq" for the moment due to slight discrepancy between rnaseq/fpkm availabilities
			{ id: 'hasfpkm', name: 'RNA-seq', type: 'categorical', values: { yes: { label: 'yes', color: '#858585' } } },
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
			{ file: 'hg19/Pediatric/sampletable/pcgp.target.info' },
			{ file: 'hg19/Pediatric/sampletable/fpkmOnly.samples' },
			{ file: 'hg19/Pediatric/sampletable/target.samples' },
			{ file: 'hg19/Pediatric/sampletable/target.samples.outcome' },
			{ file: 'hg19/Pediatric/sampletable/target.samples.tallsnp6array' },
			{ file: 'hg19/Pediatric/sampletable/pedccl.celllines' },
			{ file: 'hg19/Pediatric/sampletable/pcgp.telomerecall' },
			{ file: 'hg19/Pediatric/sampletable/pediatric.sampletable' },
			{ file: 'hg19/Pediatric/sampletable/2017xenografts.sampletable' },
			{ file: 'hg19/Pediatric/sampletable/2018_clinicalPilot' },
			{ file: 'hg19/Pediatric/sampletable/g4k.sampletable' },
			{ file: 'hg19/Pediatric/sampletable/2020_SCMC' },
			{ file: 'hg19/Pediatric/sampletable/2020_panNBL' }
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
						valuename: 'Number of somatic mutations per MB attributed to each signature',
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

	aaaannotationsampleset2matrix: {
		key: 'diagnosis_short',
		commonfeatureattributes: {
			querykeylst: ['svcnv', 'snvindel'],
			cnv: {
				valuecutoff: 0.2,
				focalsizelimit: 2000000
			},
			loh: {
				valuecutoff: 0.1,
				focalsizelimit: 2000000
			},
			snvindel: {
				excludeclasses: {
					E: 1,
					Intron: 1,
					X: 1,
					noncoding: 1
				}
			}
		},
		groups: {
			BALL: {
				groups: [
					{
						name: 'Ph-like',
						matrixconfig: {
							header: '<h3>Targetable kinase-activating lesions in Ph-like acute lymphoblastic leukemia</h3>',
							hidelegend_features: 1,
							features: [
								{ ismutation: 1, label: 'ABL1', position: 'chr9:133710642-133763062' },
								{ ismutation: 1, label: 'ABL2', position: 'chr1:179068461-179198819' },
								{ ismutation: 1, label: 'CSF1R', position: 'chr5:149432853-149492935' },
								{ ismutation: 1, label: 'PDGFRB', position: 'chr5:149493399-149535435' },
								{ ismutation: 1, label: 'JAK2', position: 'chr9:4985032-5128183' },
								{ ismutation: 1, label: 'CRLF2', position: 'chrX:1314677-1346711' },
								{ ismutation: 1, label: 'IL7R', position: 'chr5:35856861-35879734' },
								{ ismutation: 1, label: 'FLT3', position: 'chr13:28577410-28674729' },
								{ ismutation: 1, label: 'SH2B3', position: 'chr12:111843751-111889427' },
								{ ismutation: 1, label: 'JAK1', position: 'chr1:65298905-65533429' },
								{ ismutation: 1, label: 'JAK3', position: 'chr19:17935588-17958880' },
								{ ismutation: 1, label: 'TYK2', position: 'chr19:10461203-10491352' },
								{ ismutation: 1, label: 'TSLP', position: 'chr5:110405759-110413722' },
								{ ismutation: 1, label: 'IL2RB', position: 'chr22:37521874-37546170' },
								{ ismutation: 1, label: 'NTRK3', position: 'chr15:88402981-88799999' },
								{ ismutation: 1, label: 'DGKH', position: 'chr13:42614171-42830716' },
								{ ismutation: 1, label: 'PTK2B', position: 'chr8:27168998-27316908' },
								{ ismutation: 1, label: 'DYRK1A', position: 'chr21:38738091-38889753' },
								{ ismutation: 1, label: 'KRAS', position: 'chr12:25357722-25403870' },
								{ ismutation: 1, label: 'NRAS', position: 'chr1:115247084-115259515' },
								{ ismutation: 1, label: 'PTPN11', position: 'chr12:112856154-112947717' },
								{ ismutation: 1, label: 'NF1', position: 'chr17:29421944-29709134' },
								{ ismutation: 1, label: 'BRAF', position: 'chr7:140419126-140624564' },
								{ ismutation: 1, label: 'IKZF1', position: 'chr7:50343678-50472799' },
								{ ismutation: 1, label: 'PAX5', position: 'chr9:36833271-37034476' },
								{ ismutation: 1, label: 'EBF1', position: 'chr5:158122922-158526770' }
							],
							//limitsamplebyeitherannotation:[ {key:'diagnosis_subtype_short',value:'PH-LIKE'} ],
							limitsamplebyeitherannotation: [{ key: 'diagnosis_short', value: 'BALL' }]
						}
					}
				]
			}
		}
	},

	queries: {
		svcnv: {
			name: 'Pediatric tumor mutation',
			istrack: true,
			type: 'mdssvcnv',
			file: 'hg19/Pediatric/pediatric.svcnv.hg19.gz',

			/*
			this is to hide loh events which overlap with cnv events
			this is due to the fact that many such cnv-overlapping events existing in this pediatric dataset
			and jinghui wants them to be hidden
			so only to show copy-neutral loh

			TODO enable as client-side option
			*/
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

			multihidelabel_vcf: false,
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
			type: 'mdsvcf',
			viewrangeupperlimit: 2000000,
			tracks: [
				{
					file: 'hg19/Pediatric/pediatric.hg19.vcf.gz',
					type: 'vcf'
				}
			],
			singlesamples: {
				tablefile: 'hg19/Pediatric/split.vcf/table'
			}
		},

		genefpkm: {
			hideforthemoment: 1,
			name: 'Pediatric tumor RNA-seq gene FPKM',
			isgenenumeric: true,
			file: 'hg19/Pediatric/pediatric.fpkm.hg19.gz',
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
		},
		junction: {
			name: 'Pediatric tumor RNA splice junction',
			istrack: true,
			type: 'mdsjunction',
			//viewrangeupperlimit:500000,
			readcountCutoff: 5,
			file: 'hg19/Pediatric/pcgp.target.junction.hg19.gz',
			infoFilter: {
				// client handles junction-level attributes
				lst: [
					{
						key: 'type',
						label: 'Type',
						categories: {
							canonical: {
								label: 'Canonical',
								color: '#0C72A8'
							},
							exonskip: {
								label: 'Exon skipping',
								color: '#D14747',
								valuePerSample
							},
							exonaltuse: {
								label: 'Exon alternative usage',
								color: '#E69525',
								valuePerSample
							},
							a5ss: {
								label: "Alternative 5' splice site",
								color: '#476CD1',
								valuePerSample
							},
							a3ss: {
								label: "Alternative 3' splice site",
								color: '#47B582',
								valuePerSample
							},
							Unannotated: {
								label: 'Not annotated',
								color: '#787854'
							}
						},
						hiddenCategories: { Unannotated: 1 }
					}
				]
			},
			singlejunctionsummary: {
				readcountboxplotpercohort: {
					// categorical attributes only
					groups: [{ label: 'Cancer group', key: 'diagnosis_group_short' }, { label: 'Cancer', key: 'diagnosis_short' }]
				}
			}
		}
	}
}
