const common=require('../src/common')


const samplenamekey = 'sample_name'


module.exports={

	genome:'hg19',
	isMds:true,

	noHandleOnClient:1,

	about:[
	],

	sampleAssayTrack:{
		file:'hg19/pan-all/tracktable/rnabw.ball'
	},

	cohort:{
		files:[
			{file:'hg19/pan-all/sampletable/samples.ball'},
			{file:'hg19/pan-all/sampletable/samples.ball.normal'}
		],
		samplenamekey:samplenamekey,
		tohash:(item, ds)=>{
			ds.cohort.annotation[ item[samplenamekey] ] = item
		},
		sampleAttribute:{
            attributes:{
				fusion:{label:'Fusion'},
				'2nd subtype':{label:'2nd subtype',filter:1},
				PAX5_mut:{label:'PAX5_mut'},
				'PAX5cna(amp)':{label:'PAX5cna(amp)'},
				outcomeGroup:{label:'Outcome group'}, // use in gene expression sample grouping
				'RNA-seqCNA':{label:'RNA-seqCNA'},
				Gender:{label:'Gender'},
				karyotype:{label:'Karyotype'},
				WES:{label:'WES'},
				WGS:{label:'WGS'},
				SNP:{label:'SNP'},
				age:{label:'Age',isfloat:1},

				X:{label:'X',isfloat:1},
				Y:{label:'Y',isfloat:1},
				'primary subtype':{ // used in tsne
					label:'Primary subtype',
					filter:1,
					values:{
						'BCL2/MYC':{color:'#4EEE94'},
						'DUX4':{color:'#666666'},
						'ETV6-RUNX1':{color:'#EEC900'},
						'HLF':{color:'#87CEEB'},
						'Hyperdiploid':{color:'#3E9F32'},
						'KMT2A':{color:'#1F78B5'},
						'Low hypodiploid':{ color:'#1E90FF' },
						'MEF2D':{color:'#66C2A6'},
						'Near haploid':{ color:'#0000CD', },
						'NUTM1':{color:'#000000'},
						'PAX5 P80R':{ color:'#FF4500', },
						'PAX5alt':{color:'#FFA620'},
						'Ph':{color:'#CD00CD'},
						'Ph-like(ABL1-class)':{color:'#FF6A6A'},
						'Ph-like(JAK/STAT)':{color:'#8B0000'},
						'Ph-like(Other)':{color:'#FFC0CB'},
						'TCF3-PBX1':{color:'#8B6508'},
						'ZNF384':{color:'#A8DD00'},
						'Other':{color:'#BFBFBF'},
						'iAMP21':{color:'#8470FF'},
						'IKZF1 N159Y':{ color:'#CDCE34', },
						'CRLF2(non-Ph-like)':{color:'#858585'},
						'ETV6-RUNX1-like':{color:'#858585'},
						'KMT2A-like':{color:'#858585'},
						'Low hyperdiploid':{color:'#858585'},
						'ZNF384-like':{color:'#858585'},
					}
				},
				ageGroup: {
					label:'Age group',
					values:{
						Adult:{
							name:'Adult, age >= 40 years',
							color:'#1b9e77'
							},
						Childhood:{
							name:'Childhood, age < 16 years',
							color:'#d95f02'
							},
						AYA:{
							name:'Adolescent and young adult (AYA), age 16~40 years',
							color:'#7570b3'
							}
					}
				}
            },
        },

		scatterplot:{
			x:{
				attribute:'X'
			},
			y:{
				attribute:'Y'
			},
			colorbyattributes:[
				{key:'primary subtype'},
				{key:'ageGroup'}
			],
			colorbygeneexpression:{ querykey:'generlog' }, // not about mds
			querykey:'svcnv', // combine with mds
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

	queries:{

		svcnv:{

			//showfullmode:true,

			name:'BALL mutation',
			istrack:true,
			type:common.tkt.mdssvcnv,
			file:'hg19/pan-all/snp6cnv.ball/cnv.gz',

			no_loh:1,

			// cnv
			valueCutoff:0.2,
			bplengthUpperLimit:2000000, // limit cnv length to focal events

			// loh
			segmeanValueCutoff:0.1,
			lohLengthUpperLimit:2000000,

			groupsamplebyattr:{
				attrlst:[
                                	{k:'primary subtype',label:'Subtype'},
				],
				attrnamespacer:', ',
			},

		    expressionrank_querykey:'generlog',
			//vcf_querykey:'snvindel',

			multihidelabel_vcf:false,
			multihidelabel_sv:true,
		},


/*
		snvindel:{
			hideforthemoment:1,
			name:'Dicentric ALL SNV/indel',
			istrack:true,
			type:common.tkt.mdsvcf,
			viewrangeupperlimit:3000000,
			tracks:[
				{
					file:'hg19/pan-all/vcf.somatic/Dicentric_SNV_sorted.vep.out.vcf.gz',
					type:'vcf',
				},
			]
		},
		*/


		generlog:{
			name:'BALL RNA-seq gene rlog values',
			isgenenumeric:true,
			file:'hg19/pan-all/rlog.ball/rlog.gz',
			datatype:'rlog',

			// for boxplots & circles, and the standalone expression track
			itemcolor:'green',

			// for expression rank checking when coupled to svcnv
			viewrangeupperlimit:5000000,
			
			boxplotbysamplegroup:{
				attributes: [
                   {k:'outcomeGroup',label:'Outcome group'},
               	]
			},
		},
	}
}
