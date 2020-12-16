const cohorthierarchy = [
	{ k: 'diagnosis_group_short', label: 'Group', full: 'diagnosis_group_full' },
	{ k: 'diagnosis_short', label: 'Cancer', full: 'diagnosis_full' },
	{ k: 'diagnosis_subtype_short', label: 'Subtype', full: 'diagnosis_subtype_full' },
	{ k: 'diagnosis_subgroup_short', label: 'Subgroup', full: 'diagnosis_subgroup_full' }
]

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

module.exports = function(common) {
	return {
		genome: 'hg19',
		isMds: true,

		about: [],

		sampleAssayTrack: {
			file: 'files/hg19/tcga/skcm/tracktable/__table'
		},

		singlesamplemutationjson: {
			file: 'files/hg19/tcga/skcm/mutationpersample/table'
		},

		/*
	        cohort and sample annotation
	     */

		cohort: {
			files: [{ file: 'files/hg19/tcga/melanoma/sampletable/tcga.table' }],
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
			hierarchies: {
				lst: [
					{
						name: 'Cancer',
						levels: cohorthierarchy
					}
				]
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
					}
				}
			},

			mutation_signature: {
				sets: {
					//pantargetsignature
					tcgaskcmsignature: {
						name: 'Mutation signature',
						samples: {
							file: 'files/hg19/tcga/skcm/sample2signature',
							valuename: 'Total number of somatic mutations for each signature',
							skipzero: true
						},
						signatures: {
							1: {
								name: 'Proposed deamination of 5-methylcytosine (COSMIC 1)',
								//color: '#1DA850'
								color: '#afeeee'
							},
							2: {
								name: 'Activity of APOBEC family of cytidine deaminases (COSMIC 2)',
								color: '#F7ACB4'
							},
							3: {
								name: 'Defective HR DNA damage repair (COSMIC 3)',
								//color:'#F7941F',
								color: '#1CA89E' // from 10
							},
							5: {
								name: 'Unknown (COSMIC 5)',
								color: '#F7EE20'
							},
							6: {
								name: 'Defective DNA mismatch repair (COSMIC 6)',
								color: '#676767'
							},
							'7a': {
								name: 'Exposure to UV light (COSMIC 7a)',
								color: '#24A9E0'
							},
							'7b': {
								name: 'Exposure to UV light (COSMIC 7b)',
								color: '#F15C47'
							},
							'7c': {
								name: 'Exposure to UV light (COSMIC 7c)',
								color: '#2C3590'
							},
							'7d': {
								name: 'Exposure to UV light (COSMIC 7d)',
								color: '#8B603D'
							},
							8: {
								name: 'Unknown (COSMIC 8)',
								color: '#eea2ad'
							},
							13: {
								name: 'Activity of APOBEC family of cytidine deaminases (COSMIC 13)',
								color: '#652F90'
							},
							14: {
								name: 'Concurrent polymerase epsilon mutation and defective DNA mismatch repair (COSMIC 14)',
								color: '#005bd6'
							},
							40: {
								name: 'Unknown (COSMIC 40)',
								color: '#F7941F'
							},
							41: {
								name: 'Unknown (COSMIC 41)',
								color: '#d8bfd8'
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
						wgs: { name: 'WGS', label: 'Whole-genome sequencing' }
					},
					hidden: 1,
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
				mutation_signature: {
					label: 'Mutation signature'
				}
			}
		},

		queries: {
			svcnv: {
				name: 'TCGA Melanoma mutation',
				istrack: true,
				type: common.tkt.mdssvcnv,
				file: 'files/hg19/tcga/skcm/Melanoma.svcnv.TCGAnames.gz',

				// cnv
				valueCutoff: 0.2,
				bplengthUpperLimit: 2000000, // limit cnv length to focal events

				// loh
				segmeanValueCutoff: 0.1,
				lohLengthUpperLimit: 2000000,

				/*
	     		groupsamplebyattr:{
	     			attrlst:[
	     				{k:'diagnosis_group_short',label:'Group',full:'diagnosis_group_full'},
	     				{k:'diagnosis_short',label:'Cancer',full:'diagnosis_full'},
	     			],
	     			sortgroupby:{
	     				key:'diagnosis_group_short',
	     				order:['ST','BT','HM']
	     			},
	     			attrnamespacer:', ',
	     		},
	            */
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
				name: 'TCGA Melanoma SNV/indel',
				istrack: true,
				type: common.tkt.mdsvcf,
				viewrangeupperlimit: 2000000,
				tracks: [
					{
						file: 'files/hg19/tcga/skcm/Melanoma.vep.mutsig.TCGAnames.vcf.gz',
						type: 'vcf'
					}
				],
				singlesamples: {
					tablefile: 'files/hg19/tcga/melanoma/split.vcf/table'
				}
			},

			genefpkm: {
				hideforthemoment: 1,
				name: 'TCGA Melanoma RNA-seq gene FPKM',
				isgenenumeric: true,
				file: 'files/hg19/tcga/skcm/Melanoma.fpkm.TCGAnames.gz',
				datatype: 'FPKM',

				// for boxplots & circles, and the standalone expression track
				itemcolor: 'green',

				// for expression rank checking when coupled to svcnv
				viewrangeupperlimit: 5000000,

				// yu's data & method for ase/outlier
				ase: {
					qvalue: 0.05,
					meandelta_monoallelic: 0.3,
					asemarkernumber_biallelic: 0,
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
