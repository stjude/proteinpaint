const common=require('../src/common')


const samplenamekey = 'sample_name'


module.exports={

	genome:'hg19',
	isMds:true,

noHandleOnClient:1,

	about:[
	],

/*
	sampleAssayTrack:{
		file:'hg19/pan-all/tracktable/__table'
	},
	*/

	cohort:{
		files:[
			{file:'hg19/pan-all/sampletable/panall.samples'}
		],
		samplenamekey:samplenamekey,
		tohash:(item, ds)=>{
			ds.cohort.annotation[ item[samplenamekey] ] = item
		},
		sampleAttribute:{
            attributes:{
				fusion:{label:'Fusion'},
				karyotype:{label:'Karyotype'},
				subtype1:{label:'Subtype1',filter:1},
				subtype2:{label:'Subtype2',filter:1},
				X:{label:'X',isfloat:1},
				Y:{label:'Y',isfloat:1},
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
				{key:'subtype1',label:'Subtype 1'}
			],
			querykey:'svcnv'
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

			showfullmode:true,

			name:'Pan-ALL mutation',
			istrack:true,
			type:common.tkt.mdssvcnv,
			file:'hg19/pan-all/snp6cnv/cnv.gz',

			// cnv
			valueCutoff:0.2,
			bplengthUpperLimit:2000000, // limit cnv length to focal events

			// loh
			segmeanValueCutoff:0.1,
			lohLengthUpperLimit:2000000,

			groupsamplebyattr:{
				attrlst:[
                                	{k:'subtype1',label:'Subtype'},
				],
				attrnamespacer:', ',
			},

		    //expressionrank_querykey:'genefpkm',
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


		genefpkm:{
			name:'Dicentric ALL tumor RNA-seq gene FPKM',
			isgenenumeric:true,
			file:'hg19/pan-all/fpkm/dicentric.fpkm.hg19.gz',
			datatype:'FPKM',
			
			// for boxplots & circles, and the standalone expression track
			itemcolor:'green',

			// for expression rank checking when coupled to svcnv
			viewrangeupperlimit:5000000,
			
			boxplotbysamplegroup:{
				attributes: [
					//{k:'diagnosis_group_short',label:'Group',full:'diagnosis_group_full'},
					//{k:'diagnosis_short',label:'Cancer',full:'diagnosis_full'},
				        {k:'diagnosis_subtype_short',label:'Subtype'},
                           ]
			},
			outlier:{
				pvalue:0.05,
				color:'#FF8875'
			}
		},
		*/

	}
}
