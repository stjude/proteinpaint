const common=require('../src/common')


const cohorthierarchy= [
	{k:'group',label:'Group',full:'Sample group'},
]

const samplenamekey = 'sample_name'


module.exports={
	genome:'hg19',
	isMds:true,
	
	about:[
		{k:'Cohort',v:'MPAL'},
		{k:'CNV',v:'Somatic copy number changes'},
		{k:'Fusion',v:'Tumor RNA-seq fusion'},
		{k:'ITD',v:'ITD from either RNA or DNA'},
		{k:'SNV/indel',v:'Somatic mutations of tumor, and germline pathogenic mutations'},
	],
	cohort:{
		files:[
			{file:'files/hg19/MPAL/sample/MPAL.sample'},
		],
		samplenamekey:samplenamekey,
		tohash:(item,ds)=>{
			const samplename = item[samplenamekey]
			if(!samplename) return console.error(samplenamekey+' missing from a line: '+JSON.stringify(item))
			if(ds.cohort.annotation[samplename]){
				for(const k in item){
					ds.cohort.annotation[samplename][k] = item[k]
				}
			} else {
				ds.cohort.annotation[samplename] = item
			}
		},
		hierarchies:{
			lst:[
				{
					name:'Sample group',
					levels:cohorthierarchy
				}
			]
		},
		sampleAttribute:{
			attributes:{
				group:{
					label:'Sample group',
					filter:1,
				},
				'MPAL presentation':{
					label:'MPAL presentation',
				},
				Age:{
					label:'Age',
					filter:1,
				},
				'Initial therapy':{
					label:'Initial therapy',
				},
				Outcome:{
					label:'Outcome',
					filter:1,
				},
				'PAM Subtype':{
					label:'PAM Subtype',
				}
			}
		}
	},

	mutationAttribute:{
		attributes:{
			dna_assay:{
				label:'DNA assay',
				values:{
					wgs:{ name:'WGS', label:'Whole-genome sequencing' },
					wes:{ name:'WES', label:'Whole-exome sequencing'},
				},
				hidden:1,
				filter:1
			},
			vorigin:{
				label:'Variant origin',
				values:{
					somatic:{name:'Somatic'},
					germline:{name:'Germline'}
				}
			}
		}
	},
	queries:{
		svcnv:{
			name:'MPAL mutation',
			istrack:true,
			type:common.tkt.mdssvcnv,
			file:'files/hg19/MPAL/MPAL.svcnv.gz',
	
			/*
			// cnv
			valueCutoff:0.2,
			bplengthUpperLimit:2000000, // limit cnv length to focal events

			//loh
			segmeanValueCutoff:0.1,
			lohLengthUpperLimit:2000000,
			*/
			groupsamplebyattr:{
				attrlst:[
					{k:'group',label:'Group',full:'Sample group'},
				],
			},
			
			expressionrank_querykey:'genefpkm',
			vcf_querykey:'snvindel',

			multihidelabel_vcf:true,
			multihidelabel_fusion:false,
			multihidelabel_sv:true,
		
			legend_vorigin:{
				key:'vorigin',
				somatic:'somatic',
				germline:'germline'
			},
		},

		snvindel:{
			hideforthemoment:1,
			name:'MPAL SNV/indel',
			istrack:true,
			type:common.tkt.mdsvcf,
			viewrangeupperlimit:2000000,
			tracks:[
				{
					file:'files/hg19/MPAL/MPAL.hg19.vcf.gz',
					type:'vcf',
				},
			]
		},
		genefpkm:{
			name:'MPAL RNA-seq gene FPKM values',
			isgenenumeric:true,
			file:'files/hg19/MPAL/MPAL.fpkm.gz',
			datatype:'FPKM',
			
			// for boxplots & circles, and the standalone expression track
			itemcolor:'green',

			// for expression rank checking when coupled to svcnv
			viewrangeupperlimit:5000000,
	
			boxplotbysamplegroup:{
				attributes:[
					{k:'group',label:'Group'},
				]
			}
		}
	}
	
}
