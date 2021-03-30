const cohorthierarchy = [{ k: 'group', label: 'Group', full: 'subtype' }]

const samplenamekey = 'sample_name'

module.exports = function(common) {
	return {
		genome: 'hg19',
		isMds: true,

		about: [
			{ k: 'Cohort', v: 'TALL' },
			{ k: 'CNV', v: 'Somatic copy number changes' },
			{ k: 'LOH', v: 'Somatic copy-neutral LOH' },
			{ k: 'SV', v: 'Somatic DNA structural variation' },
			{ k: 'Fusion', v: 'Tumor RNA-seq fusion' },
			{ k: 'ITD', v: 'ITD from either RNA or DNA' },
			{ k: 'SNV/indel', v: 'Somatic mutations of tumor, and germline pathogenic mutations' }
		],
		cohort: {
			files: [{ file: 'hg19/pan-tall/sampletable/pan-tall.sample.etp' }],
			samplenamekey: samplenamekey,
			tohash: (item, ds) => {
				const samplename = item[samplenamekey]
				if (!samplename) return console.error(samplenamekey + ' missing from a line: ' + JSON.stringify(item))
				if (ds.cohort.annotation[samplename]) {
					for (const k in item) {
						ds.cohort.annotation[samplename][k] = item[k]
					}
				} else {
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
					},
					sample_type: {
						label: 'Sample type',
						filter: 1
					}
				}
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
								color: '#1DA850'
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
								color: '#12693A'
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
						snp6: { name: 'SNP6', label: 'SNP Array 6.0' }
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
						pantarget: { name: 'Pan-TARGET', label: 'Pan-cancer analysis of the NCI TARGET dataset' }
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
					appendto_link: 'http://www.ncbi.nlm.nih.gov/pubmed/'
				},
				mutation_signature: {
					label: 'Mutation signature'
				}
			}
		},
		queries: {
			svcnv: {
				name: 'TALL mutation',
				istrack: true,
				type: common.tkt.mdssvcnv,
				file: 'hg19/pan-tall/TALL.svcnv.hg19.gz',

				// cnv
				valueCutoff: 0.2,
				bplengthUpperLimit: 2000000, // limit cnv length to focal events

				//loh
				segmeanValueCutoff: 0.1,
				lohLengthUpperLimit: 2000000,
				groupsamplebyattr: {
					attrlst: [
						//{k:'group',label:'Group',full:'Subtype'},
						{ k: 'ETP status', label: 'ETP status', full: 'ETP status' }
					]
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
				name: 'TALL SNV/indel',
				istrack: true,
				type: common.tkt.mdsvcf,
				viewrangeupperlimit: 2000000,
				tracks: [
					{
						file: 'hg19/pan-tall/TALL.hg19.vcf.gz',
						type: 'vcf'
					}
				]
			},
			genefpkm: {
				name: 'TALL RNA-seq gene log2(FPKM) values',
				isgenenumeric: true,
				file: 'hg19/pan-tall/panTALL.fpkm.hg19.gz',
				datatype: 'log2(FPKM)',

				// for boxplots & circles, and the standalone expression track
				itemcolor: 'green',

				// for expression rank checking when coupled to svcnv
				viewrangeupperlimit: 5000000,

				boxplotbysamplegroup: {
					attributes: [
						//{k:'group',label:'Subtype'},
						{ k: 'ETP status', label: 'ETP status' }
					],
					additionals: [{ label: 'Group name', attributes: [{ k: 'group' }] }]
				}
			}
		}
	}
}
