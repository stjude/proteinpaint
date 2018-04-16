const common=require('../src/common')


const samplenamekey = 'sample_name'


module.exports={

	genome:'hg19',
	isMds:true,

	noHandleOnClient:1,

	about:[
	],

	cohort:{
		files:[
			// possible to have file-specific logic
			{file:'hg38/scd/mds/sample.table'}
		],
		samplenamekey:samplenamekey,
		tohash:(item, ds)=>{
			ds.cohort.annotation[ item[samplenamekey] ] = item
		},
		sampleAttribute:{
			attributes:{
				CorrectedHbF: {
					label:'HbF level',
					isfloat:true,
					showintrack:true
				}
			}
		}
	},


	queries:{

		svcnv:{


			name:'SCD germline CNV',
			showfullmode:true,
			istrack:true,
			type:common.tkt.mdssvcnv,
			file:'hg38/scd/mds/cnv.gz',

			// cnv
			valueCutoff:0.2,
			bplengthUpperLimit:2000000, // limit cnv length to focal events


			/*
			to sort sample groups consistently, on client, not on server
			*/



			multihidelabel_vcf:false,
			multihidelabel_sv:true,
		},



	}
}
