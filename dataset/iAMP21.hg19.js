const common=require('../src/common')


const samplenamekey = 'sample_name'



const valuePerSample={
	key:'percentage',
	label:'Percentage',
	cutoffValueLst:[
		{side:'>',value:5,label:'>5%'},
		{side:'>',value:10,label:'>10%'},
		{side:'>',value:20,label:'>20%'},
		{side:'>',value:30,label:'>30%'},
		{side:'>',value:40,label:'>40%'}
	]
}



module.exports={

	genome:'hg19',
	isMds:true,


	about:[
	],

	sampleAssayTrack:{
		file:'hg19/clingen/subset/iAMP21/tracktable/__table'
	},
	cohort:{
		files:[
			{file:'hg19/clingen/subset/iAMP21/sampletable/iAMP21.sample'},
		],
		samplenamekey:samplenamekey,
		tohash:(item, ds)=>{
			const n = item[samplenamekey]
			if(ds.cohort.annotation[n]) {
				for(const k in item) {
					ds.cohort.annotation[n][k] = item[k]
				}
			} else {
				ds.cohort.annotation[ n ] = item
			}
		},
		sampleAttribute:{
            attributes:{
				fusion:{label:'Fusion'},
				'2nd subtype':{label:'2nd subtype',filter:1},
				PAX5_mut:{label:'PAX5_mut'},
				'PAX5cna(amp)':{label:'PAX5cna(amp)'},
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
				},
				ageGroup: {
					label:'Age group',
					values:{
						Adult:{
							name:'Adult, age >= 40 years',
							color:'#1b9e77'
							},
						'Childhood HR':{
							name:'Children high-risk: age <1 or >9 year or WBC count >50e9/L',
							color:'#d95f02'
							},
						'Childhood SR':{
							name:'Children standard-risk: age 1 ~ 9 years and WBC count <50e9/L',
							color:'#027CD9'
							},
						AYA:{
							name:'Adolescent and young adult (AYA), age 16~40 years',
							color:'#7570b3'
							}
					}
				}
            },
        }
    },






	
	mutationAttribute:{
		attributes:{
			dna_assay:{
				label:'DNA assay',
				values:{
					wgs:{ name:'WGS',label:'Whole-genome sequencing' },
					wes:{ name:'WES',label:'Whole-exome sequencing'},
				},
				hidden:1,
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
			medal:{
				label:'Medal',
				values:{
					GOLD:{name:'Gold'},
					BRONZE:{name:'Bronze'},
					SILVER:{name:'Silver'}
				},
				filter:1
			},
			manual_review:{
				label:'Manual review',
				values:{
					bad:{name:'Bad'},
					good:{name:'Good'}
				}
			}
		}
	},


	queries:{

		svcnv:{

			//showfullmode:true,

			name:'iAMP21 mutation',
			istrack:true,
			type:common.tkt.mdssvcnv,
			file:'hg19/clingen/subset/iAMP21/iAMP21.svcnv.gz',

			no_loh:1,

			// cnv
			valueCutoff:0.2,
			bplengthUpperLimit:2000000, // limit cnv length to focal events

			// loh
			segmeanValueCutoff:0.1,
			lohLengthUpperLimit:2000000,


		    expressionrank_querykey:'genefpkm',
		    vcf_querykey:'snvindel',

			multihidelabel_vcf:false,
			multihidelabel_sv:true,
		},



		snvindel:{
			hideforthemoment:1,
			name:'iAMP21 SNV/indel',
			istrack:true,
			type:common.tkt.mdsvcf,
			viewrangeupperlimit:3000000,
			tracks:[
				{
					file:'hg19/clingen/subset/iAMP21/iAMP21.vcf.gz',
					type:'vcf',
				},
			]
		},
		


		genefpkm:{
			name:'iAMP21 RNA-seq gene log2(FPKM) values',
			isgenenumeric:true,
			file:'hg19/clingen/subset/iAMP21/iAMP21.fpkm.gz',
			datatype:'log2(FPKM)',
			no_ase: true,

			// for boxplots & circles, and the standalone expression track
			itemcolor:'green',

			// for expression rank checking when coupled to svcnv
			viewrangeupperlimit:5000000,
			
		}



	}
}
