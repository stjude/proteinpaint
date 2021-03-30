const cohorthierarchy = [{ k: 'age_group', label: 'Age group' }]

const samplenamekey = 'sample_name'

module.exports = function(common) {
	return {
		genome: 'hg19',
		isMds: true,

		about: [
			{ k: 'Cohort', v: 'panNBL' },
			{ k: 'CNV', v: 'Somatic copy number changes' },
			{ k: 'LOH', v: 'Somatic copy-neutral LOH' },
			{ k: 'SV', v: 'Somatic DNA structural variation' },
			{ k: 'Fusion', v: 'Tumor RNA-seq fusion' },
			{ k: 'ITD', v: 'ITD from either RNA or DNA' },
			{ k: 'SNV/indel', v: 'Somatic mutations of tumor, and germline pathogenic mutations' },
			{ k: 'RNA splice junction', v: 'Tumor RNA splice junctions' }
		],
		singlesamplemutationjson: {
			file: 'hg19/pan-nbl/mutationpersample/table'
		},

		/*
		cohort and sample annotation
		*/
		cohort: {
			files: [{ file: 'hg19/pan-nbl/sampletable/NBL.sample' }],
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
						name: 'Age group',
						levels: cohorthierarchy
					}
				]
			},
			sampleAttribute: {
				attributes: {
					age_group: {
						label: 'Age group',
						filter: 1,
						hidden: 1
					},
					diagnosis_age_years: {
						label: 'Diagnosis age years'
					},
					diagnosis_age_days: {
						label: 'Diagnosis age days'
					},
					living_status: {
						label: 'Living status'
					},
					stage: {
						label: 'Stage'
					},
					coding_mutations: {
						label: 'Coding mutations'
					},
					MYCN: {
						label: 'MYCN'
					},
					ATRX: {
						label: 'ATRX'
					},
					ALK: {
						label: 'ALK'
					},
					del_1p: {
						label: 'del_1p'
					},
					gain_2p: {
						label: 'gain_2p'
					},
					del_3p: {
						label: 'del_3p'
					},
					del_4p: {
						label: 'del_4p'
					},
					gain_7q: {
						label: 'gain_7q'
					},
					del_11q: {
						label: 'del_11q'
					},
					gain_17q: {
						label: 'gain_17q'
					},
					chr11_17sv: {
						label: 'chr11_17sv'
					},
					TERT: {
						label: 'TERT'
					},
					SHANK2: {
						label: 'SHANK2'
					},
					PTPRD: {
						label: 'PTPRD'
					},
					'EFS(days)': {
						label: 'Event-free survival, days',
						isinteger: 1,
						clientnoshow: 1
					},
					overall_survival_time_days: {
						label: 'Overall survival, days',
						isinteger: 1,
						clientnoshow: 1
					},
					'event-free is censored': {
						label: 'Event free survival, censored',
						isinteger: 1,
						clientnoshow: 1
					}
				}
			},

			survivalplot: {
				plots: {
					efs: {
						name: 'Event-free survival',
						serialtimekey: 'EFS(days)',
						iscensoredkey: 'event-free is censored',
						timelabel: 'Days'
					},
					os: {
						name: 'Overall survival',
						serialtimekey: 'overall_survival_time_days',
						iscensoredkey: 'event-free is censored',
						timelabel: 'Days'
					}
				},
				samplegroupattrlst: [
					{
						key: 'age_group'
					}
				]
			},

			mutation_signature: {
				sets: {
					panNBLsignature: {
						name: 'Mutation signature',
						samples: {
							file: 'hg19/pan-nbl/mutationsignature/NBLsigStregth',
							valuename: 'Number of somatic mutations attributed to each signature',
							skipzero: true
						},
						signatures: {
							1: {
								name: 'clock-like and caused by 5-methylcytosine deamination',
								color: '#1DA850'
							},
							2: {
								name: 'caused by homologous recombination deficiency',
								color: '#F7ACB4'
							},
							3: {
								name: 'clock-like but of unknown cause',
								color: '#1CA89E'
							},
							4: {
								name: 'caused by reactive oxygen species',
								color: '#12693A'
							},
							5: {
								name: 'caused by cisplatin',
								color: '#F7EE20'
							},
							6: {
								name: 'unknown cause',
								color: '#24A9E0'
							},
							7: {
								name: 'artifact of CGI sequencing',
								color: '#F15C47'
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
						wes: { name: 'WES', label: 'Whole-exome sequencing' }
					},
					hidden: 1,
					filter: 1
				},
				vorigin: {
					label: 'Variant origin',
					values: {
						somatic: { name: 'Somatic' },
						germline: { name: 'Germline' }
					}
				},
				mutation_signature: {
					label: 'Mutation signature'
				}
			}
		},

		queries: {
			svcnv: {
				name: 'panNBL tumor mutation',
				istrack: true,
				type: common.tkt.mdssvcnv,
				file: 'hg19/pan-nbl/NBL.svcnv.gz',

				// cnv
				valueCutoff: 0.2,
				bplengthUpperLimit: 2000000, // limit cnv length to focal events

				// loh
				segmeanValueCutoff: 0.1,
				lohLengthUpperLimit: 2000000,

				groupsamplebyattr: {
					attrlst: [{ k: 'age_group', label: 'Age group' }]
				},

				//expressionrank_querykey:'genefpkm',
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
				name: 'panNBL tumor SNV/indel',
				istrack: true,
				type: common.tkt.mdsvcf,
				tracks: [
					{
						file: 'hg19/pan-nbl/NBL.hg19.vcf.gz',
						type: 'vcf'
					}
				],
				siglesamples: {
					tablefile: 'hg19/pan-nbl/split.vcf/table'
				}
			}

			/*
			genefpkm:{
				hideforthemoment:1,
				name:'Pediatric tumor RNA-seq gene FPKM',
				isgenenumeric:true,
				file:'hg19/Pediatric/pediatric.fpkm.hg19.gz',
				datatype:'FPKM',
				
				// for boxplots & circles, and the standalone expression track
				itemcolor:'green',

				// for expression rank checking when coupled to svcnv
				viewrangeupperlimit:5000000,

				
				//one boxplot for each sample group
				//the grouping method must be same as svcnv
				
				boxplotbysamplegroup:{
					attributes: [
						{k:'diagnosis_group_short',label:'Group',full:'diagnosis_group_full'},
						{k:'diagnosis_short',label:'Cancer',full:'diagnosis_full'},
					]
				},


			},
	*/
		}
	}
}
