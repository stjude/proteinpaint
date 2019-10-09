const common=require('../src/common')



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


const samplenamekey = 'sample_name'


module.exports={

	genome:'hg19',
	isMds:true,

	about:[
	],

	sampleAssayTrack:{
		file:'hg19/COGRelapse/tracktable/__table'
	},
	singlesamplemutationjson:{
		file:'hg19/COGRelapse/mutationpersample/table'
	},


	/*
	cohort and sample annotation
	*/
	cohort:{
		files:[
			{file:'hg19/COGRelapse/sampletable/COGRelapse.sample'}
		],
		samplenamekey:samplenamekey,
		tohash:(item, ds)=>{
			const samplename = item[samplenamekey]
			if(!samplename) return console.error(samplenamekey+' missing from a line: '+JSON.stringify(item))
			if(ds.cohort.annotation[ samplename ]) {
				// append info
				for(const k in item) {
					ds.cohort.annotation[samplename][ k ] = item[k]
				}
			} else {
				// new sample
				ds.cohort.annotation[ samplename ] = item
			}
		},
		sampleAttribute:{
			attributes:{
			},
		},

	},
		
	queries:{

		svcnv:{
			name:'COGRelapse tumor mutation',
			istrack:true,
			type:common.tkt.mdssvcnv,
			file:'hg19/COGRelapse/COGRelapse.svcnv.gz',

			// cnv
			valueCutoff:0.2,
			bplengthUpperLimit:2000000, // limit cnv length to focal events

			// loh
			segmeanValueCutoff:0.1,
			lohLengthUpperLimit:2000000,


			expressionrank_querykey:'genefpkm',

			multihidelabel_vcf:true,
			multihidelabel_fusion:false,
			multihidelabel_sv:true,

			legend_vorigin:{
				key:'vorigin',
				somatic:'somatic',
				germline:'germline'
			},

		},



		genefpkm:{
			hideforthemoment:1,
			name:'COGRelapse tumor RNA-seq gene FPKM',
			isgenenumeric:true,
			file:'hg19/COGRelapse/COGRelapse.fpkm.gz',
			datatype:'FPKM',
			
			// for boxplots & circles, and the standalone expression track
			itemcolor:'green',

			// for expression rank checking when coupled to svcnv
			viewrangeupperlimit:5000000,

			/*
			one boxplot for each sample group
			the grouping method must be same as svcnv
			*/
			boxplotbysamplegroup:{
				attributes: [
					{k:'diagnosis_group_short',label:'Group',full:'diagnosis_group_full'},
					{k:'diagnosis_short',label:'Cancer',full:'diagnosis_full'},
				]
			},
		}
		}
}
