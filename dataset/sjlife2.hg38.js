

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
	},

	// mds2 track
	track: {
		vcf: {
			file:'hg38/sjlife/vcf.2019aacr/cohort.vcf.gz'
		},
		/*
		svcnv: {
		},
		genevalues: {
			list: [
				// fpkm
				// protein
			]
		}
		*/
	}
}
