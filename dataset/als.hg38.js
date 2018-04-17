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
					label:'Diagnosis',
					filter:1,
				}
			}
		}
	},


	queries:{

		svcnv:{


			name:'ALS germline CNV',
			showfullmode:true,
			istrack:true,
			type:common.tkt.mdssvcnv,
			file:'hg38/als/mds/cnv.gz',

			// cnv
			valueCutoff:0.2,
			bplengthUpperLimit:2000000, // limit cnv length to focal events


			groupsamplebyattr:{ 
				attrlst:[
					{k:'ALSRD_Dx',label:'Diagnosis'},
				],
				sortgroupby:{
					key:'ALSRD_Dx',
					order:['ALS','ALS-FTD','FTD','HSP (complicated)','HSP (pure)','PLS','PMA']
				},
				attrnamespacer:', ',
			},

			multihidelabel_vcf:false,
			multihidelabel_sv:true,
		},



	}
}
