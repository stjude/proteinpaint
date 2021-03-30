const samplenamekey = 'sample_name'

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

module.exports = function(common) {
	return {
		genome: 'hg19',
		isMds: true,

		about: [],

		sampleAssayTrack: {
			file: 'hg19/pan-all/tracktable/panall.table'
		},

		cohort: {
			files: [
				{ file: 'hg19/pan-all/sampletable/samples.ball' },
				{ file: 'hg19/pan-all/sampletable/samples.ball.normal' },
				{ file: 'hg19/pan-all/sampletable/normalCell.sample' },
				{ file: 'hg19/pan-all/sampletable/outcome.ball' }
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
					fusion: { label: 'Fusion' },
					'2nd subtype': { label: '2nd subtype', filter: 1 },
					PAX5_mut: { label: 'PAX5_mut' },
					'PAX5cna(amp)': { label: 'PAX5cna(amp)' },
					'RNA-seqCNA': { label: 'RNA-seqCNA' },
					Gender: { label: 'Gender' },
					karyotype: { label: 'Karyotype' },
					WES: { label: 'WES' },
					WGS: { label: 'WGS' },
					SNP: { label: 'SNP' },
					age: { label: 'Age', isfloat: 1 },

					X: { label: 'X', isfloat: 1 },
					Y: { label: 'Y', isfloat: 1 },
					'primary subtype': {
						// used in tsne
						label: 'Primary subtype',
						filter: 1,
						values: {
							'BCL2/MYC': { color: '#4EEE94' },
							DUX4: { color: '#666666' },
							'ETV6-RUNX1': { color: '#EEC900' },
							HLF: { color: '#87CEEB' },
							Hyperdiploid: { color: '#3E9F32' },
							KMT2A: { color: '#1F78B5' },
							'Low hypodiploid': { color: '#1E90FF' },
							MEF2D: { color: '#66C2A6' },
							'Near haploid': { color: '#0000CD' },
							NUTM1: { color: '#000000' },
							'PAX5 P80R': { color: '#FF4500' },
							PAX5alt: { color: '#FFA620' },
							Ph: { color: '#CD00CD' },
							//'Ph-like':{color:'#8B0000'},
							'TCF3-PBX1': { color: '#8B6508' },
							ZNF384: { color: '#A8DD00' },
							iAMP21: { color: '#8470FF' },
							'IKZF1 N159Y': { color: '#CDCE34' },
							'CRLF2(non-Ph-like)': { color: '#BFBFBF' },
							'ETV6-RUNX1-like': { color: '#BFBFBF' },
							'KMT2A-like': { color: '#BFBFBF' },
							'Low hyperdiploid': { color: '#BFBFBF' },
							'ZNF384-like': { color: '#BFBFBF' },
							Other: { color: '#BFBFBF' },
							'Ph-like(ABL-class)': { color: '#FF6A6A' },
							'Ph-like(CRLF2)': { color: '#6A147D' },
							'Ph-like(other JAK/STAT)': { color: '#8B0000' },
							'Ph-like(other)': { color: '#FFC0CB' }
						}
					},
					ageGroup: {
						label: 'Age group',
						values: {
							Adult: {
								name: 'Adult, age >= 40 years',
								color: '#1b9e77'
							},
							'Childhood HR': {
								name: 'Children high-risk: age <1 or >9 year or WBC count >50e9/L',
								color: '#d95f02'
							},
							'Childhood SR': {
								name: 'Children standard-risk: age 1 ~ 9 years and WBC count <50e9/L',
								color: '#027CD9'
							},
							AYA: {
								name: 'Adolescent and young adult (AYA), age 16~40 years',
								color: '#7570b3'
							}
						}
					},
					'F_efstime (yrs)': {
						label: 'Event free survival, years',
						isfloat: 1,
						clientnoshow: 1
					},
					F_efscensor: {
						label: 'Event free survival, censored',
						isinteger: 1,
						clientnoshow: 1
					},
					'F_ostime (yrs)': {
						label: 'Overall survival, years',
						isfloat: 1,
						clientnoshow: 1
					},
					F_oscensor: {
						label: 'Overall survival, censored',
						isinteger: 1,
						clientnoshow: 1
					}
				}
			},

			scatterplot: {
				x: {
					attribute: 'X'
				},
				y: {
					attribute: 'Y'
				},
				colorbyattributes: [{ key: 'primary subtype' }, { key: 'ageGroup' }],
				colorbygeneexpression: { querykey: 'genefpkm' }, // not about mds
				querykey: 'svcnv', // combine with mds

				tracks: [
					{
						type: 'bigwig',
						hidden: 1,
						file: 'hg19/pan-all/RNAbw.normal/SJNORM012512_G2.bw',
						name: 'SJNORM012512_G2 RNA'
					},
					{
						type: 'bigwig',
						hidden: 1,
						file: 'hg19/pan-all/RNAbw.normal/SJNORM012512_G4.bw',
						name: 'SJNORM012512_G4 RNA'
					},
					{
						type: 'bigwig',
						file: 'hg19/pan-all/RNAbw.normal/SJNORM016096_G1.bw',
						name: 'SJNORM016096_G1 CD34+/19+ RNA'
					},
					{
						type: 'bigwig',
						file: 'hg19/pan-all/RNAbw.normal/SJNORM016096_G2.bw',
						name: 'SJNORM016096_G2 CD19+/10+ RNA'
					},
					{
						type: 'bigwig',
						file: 'hg19/pan-all/RNAbw.normal/SJNORM016096_G3.bw',
						name: 'SJNORM016096_G3 CD19+/CD10-/KL+ RNA'
					},
					{
						type: 'bigwig',
						file: 'hg19/pan-all/RNAbw.normal/SJNORM016096_G4.bw',
						name: 'SJNORM016096_G4 CD19+/CD10-/KL- RNA'
					}
				]
			},

			survivalplot: {
				plots: {
					efs: {
						name: 'Event-free survival',
						serialtimekey: 'F_efstime (yrs)',
						iscensoredkey: 'F_efscensor',
						timelabel: 'Years'
					},
					os: {
						name: 'Overall survival',
						serialtimekey: 'F_ostime (yrs)',
						iscensoredkey: 'F_oscensor',
						timelabel: 'Years'
					}
				},
				samplegroupattrlst: [
					{
						key: 'primary subtype'
					}
				]
			}
		},

		/*
		mutationAttribute:{
			attributes:{
				dna_assay:{
					label:'DNA assay',
					values:{
						cgi:{ name:'CGI',label:'Complete Genomics whole-genome sequencing', },
						wgs:{ name:'WGS',label:'Whole-genome sequencing' },
						wes:{ name:'WES',label:'Whole-exome sequencing'},
						snp6:{ name:'SNP6',label:'SNP Array 6.0'}
					},
					hidden:1,
					filter:1
				},
				rna_assay:{
					label:'RNA assay',
					values:{
						total:{ name:'Total RNA'},
						polya:{ name:'Poly(A)-selected'},
					},
					hidden:1,
					filter:1
				},
				project:{
					label:'Project',
					values:{
						pantarget:{ name:'Pan-TARGET', label:'Pan-cancer analysis of the NCI TARGET dataset'},
						pcgp:{ name:'PCGP',label:'Pediatric Cancer Genome Project'},
						pedccl:{name:'PedCCL',label:'Pediatric Cancer Cell Lines'}
					},
					filter:1
				},
				vorigin:{
					label:'Variant origin',
					values:{
						somatic:{name:'Somatic'},
						germline:{name:'Germline'}
					},
					filter:1
				},
				pmid:{
					label:'PubMed',
					appendto_link:'http://www.ncbi.nlm.nih.gov/pubmed/'
				}
			}
		},
		*/

		queries: {
			svcnv: {
				//showfullmode:true,

				name: 'BALL mutation',
				istrack: true,
				type: common.tkt.mdssvcnv,
				file: 'hg19/pan-all/snp6cnv.ball/cnv.gz',

				no_loh: 1,

				// cnv
				valueCutoff: 0.2,
				bplengthUpperLimit: 2000000, // limit cnv length to focal events

				// loh
				segmeanValueCutoff: 0.1,
				lohLengthUpperLimit: 2000000,

				groupsamplebyattr: {
					attrlst: [{ k: 'primary subtype', label: 'Subtype' }],
					attrnamespacer: ', '
				},

				expressionrank_querykey: 'genefpkm',
				vcf_querykey: 'snvindel',

				multihidelabel_vcf: false,
				multihidelabel_sv: true
			},

			snvindel: {
				hideforthemoment: 1,
				name: 'BALL SNV/indel',
				istrack: true,
				type: common.tkt.mdsvcf,
				viewrangeupperlimit: 3000000,
				tracks: [
					{
						file: 'hg19/pan-all/vcf/somatic.vcf.gz',
						type: 'vcf'
					}
				]
			},

			genefpkm: {
				name: 'BALL RNA-seq gene log2(FPKM) values',
				isgenenumeric: true,
				file: 'hg19/pan-all/fpkm.ball/fpkm.gz',
				datatype: 'log2(FPKM)',
				no_ase: true,

				// for boxplots & circles, and the standalone expression track
				itemcolor: 'green',

				// for expression rank checking when coupled to svcnv
				viewrangeupperlimit: 5000000,

				boxplotbysamplegroup: {
					attributes: [{ k: 'primary subtype', label: 'Subtype' }]
				}
			},

			junction: {
				name: 'BALL tumor RNA splice junction',
				istrack: true,
				type: common.tkt.mdsjunction,
				viewrangeupperlimit: 500000,
				readcountCutoff: 5,
				file: 'hg19/pan-all/junction/pan-BALL.junction.gz',
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
									valuePerSample: valuePerSample
								},
								exonaltuse: {
									label: 'Exon alternative usage',
									color: '#E69525',
									valuePerSample: valuePerSample
								},
								a5ss: {
									label: "Alternative 5' splice site",
									color: '#476CD1',
									valuePerSample: valuePerSample
								},
								a3ss: {
									label: "Alternative 3' splice site",
									color: '#47B582',
									valuePerSample: valuePerSample
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
						groups: [{ label: 'Primary subtype', key: 'primary subtype' }]
					}
				}
			}
		}
	}
}
