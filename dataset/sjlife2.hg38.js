

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

	mutationAttribute: {
		attributes: {
			AF: {
				label:'Cohort frequency',
				isfloat:1,
			},
			AF_gnomAD: {
				label:'gnomAD frequency',
				isfloat:1
			},
		}
	},

	// mds2 track
	track: {
		name:'SJLife germline SNV',
		vcf: {
			file:'hg38/sjlife/cohort.vcf.gz',
			viewrangeupperlimit: 200000,
			numerical_axis: {
				axisheight: 150,
				info_keys: ['AF','AF_gnomAD'],
				use_info_key: 'AF',
				in_use: true // to use numerical axis by default
				// how to define complex things such as boxplot or on the fly summarized data from samples
			},
			plot_mafcov: {
				show_samplename: 1
				// may allow jwt
			},
			termdb_bygenotype: {
				// this only works for stratifying samples by mutation genotype
				// svcnv or svcnv+snv combined may need its own trigger
			}
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
