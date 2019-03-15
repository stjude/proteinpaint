const common=require('../src/common')


const samplenamekey = 'sjlid_w88'


module.exports={

	isMds:true,



	cohort:{
		files:[
			{file:'files/hg38/sjlife/clinical/test/matrix'}
		],
		samplenamekey: samplenamekey,
		tohash: (item, ds)=>{
			const n = item[samplenamekey]
			if(ds.cohort.annotation[n]) {
				for(const k in item) {
					ds.cohort.annotation[n][k] = item[k]
				}
			} else {
				ds.cohort.annotation[ n ] = item
			}
		},

		termdb: {
			term2term:{
				file:'files/hg38/sjlife/clinical/term2term'
			},
			termjson:{
				file:'files/hg38/sjlife/clinical/termjson'
			},
			default_rootterm:[
				{id:'Cancer-related Variables'},
				{id:'Demographics/health behaviors'},
				{id:'Outcomes'}
			]
		},

		sampleAttribute:{
			attributes:{
				agedx:{
					label:'Age at Cancer Diagnosis',
					isfloat:1
				},
				DOXED_sum:{
					label:'Cumulative Anthracycline (Doxorubicin Equivalent Dose)',
					isfloat:1
				},
				CED_sum:{
					label:'Cumulative Alkylating Agent (Cyclophosphamide Equivalent Dose)',
					isfloat:1
				},
			}
		}
	},

/*
	locusAttribute:{ // FIXME
		attributes:{
			CLNSIG:{
				label:'Clinical significance',
				filter:1,
				values:{
				}
			}
		}
	},

	alleleAttribute:{
		attributes:{
			ExAC_AF:{
				label:'ExAC',
				isnumeric:1,
				filter:1,
				cutoffvalue:0.01,
				keeplowerthan:true
			},
			AF:{
				label:'AF',
				isnumeric:1,
				filter:1,
				cutoffvalue:0.01,
				keeplowerthan:true
			},
			CADD_phred:{
				label:'CADD_phred',
				filter:1,
				isnumeric:1,
				cutoffvalue:10,
			}
		}
	},
	*/

	mutationAttribute:{
		attributes:{
			discordantreads:{
				label:'Discordant read pairs'
			}
		}
	},


}
