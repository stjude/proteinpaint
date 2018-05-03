const common=require('../src/common')


const samplenamekey = 'sample_name'


module.exports={

	isMds:true,

	noHandleOnClient:1,

	about:[
	],

	sampleAssayTrack:{
		file:'hg38/als/mds/assaytracks/__table'
	},


	cohort:{
		files:[
			{file:'hg38/als/mds/sample.table'}
		],
		samplenamekey:samplenamekey,
		tohash:(item, ds)=>{
			ds.cohort.annotation[ item[samplenamekey] ] = item
		},
		sampleAttribute:{
			attributes:{
				ALSRD_Dx: {
					label:'ALSRD_Dx',
					filter:1,
				}
			}
		}
	},

	alleleAttribute:{
		attributes:{
			AF:{
				label:'AF',
				isnumeric:1,
				filter:1,
				cutoffvalue:0.1,
				keeplowerthan:true
			}
		}
	},


	queries:{

		svcnv:{


			name:'ALS germline CNV',
			showfullmode:true,
			istrack:true,
			type:common.tkt.mdssvcnv,
			file:'hg38/als/mds/svcnv.gz',

			// cnv
			valueCutoff:0.2,
			bplengthUpperLimit:2000000, // limit cnv length to focal events


			groupsamplebyattr:{ 
				attrlst:[
					{k:'ALSRD_Dx',label:'ALSRD_Dx'},
				],
				sortgroupby:{
					key:'ALSRD_Dx',
					order:['ALS','ALS-FTD','FTD','HSP (complicated)','HSP (pure)','PLS','PMA']
				},
				attrnamespacer:', ',
			},

			vcf_querykey:'snvindel',

			multihidelabel_vcf:false,
			multihidelabel_sv:true,
		},


		snvindel:{
			name:'ALS germline SNV/indel',
			istrack:true,
			type:common.tkt.mdsvcf,
			viewrangeupperlimit:2000000,
			tracks:[
				{
					file:'hg38/als/mds/vcf/ALS329.vep.ann.hg38_multianno.clinvar.ExAC.NFE.vcf.gz',
					type:'vcf',
					samplenameconvert: str=>{
						return str.split('-')[0]
					}
				},
			]
		},



	}
}
