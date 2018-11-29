const common=require('../src/common')

const cohorthierarchy=[
	{k:'Genomic_subgroup',label:'Group',full:'Genomic_subgroup'}
]

const samplenamekey = 'sample_name'

module.exports={
	genome:'hg19',
	isMds:true,
	about:[
		{k:'Cohort',v:'AEL'},
		{k:'CNV',v:'Somatic copy number changes'},
		{k:'SV',v:'Somatic DNA structural variation'},
		{k:'Fusion',v:'Tumor RNA-seq fusion'},
		{k:'ITD',v:'ITD from either RNA or DNA'},
		{k:'SNV/indel',v:'Somatic mutations of tumor, and germline pathogenic mutations'},
	],
	/*
	cohort and sample annotation
	*/
	cohort:{
		files:[
			{file:'hg19/ael-mds/sampletable/AEL.sampletable'}
		],
		samplenamekey:samplenamekey,
		tohash:(item,ds)=>{
			const samplename = item[samplenamekey]
			if(!samplename) return console.error(samplenamekey+' missing from a line: '+JSON.stringify(item))
			if(ds.cohort.annotation[samplename]){
				for(const k in item){
					//append info
					ds.cohort.annotation[samplename][k] = item[k]
				}
			} else {
				// new sample
				ds.cohort.annotation[samplename] = item

			}
		},
		hierarchies:{
			lst:[
				{
					name:'Group',
					levels:cohorthierarchy
				}
			]
		},

		sampleAttribute:{
			attributes:{
				Genomic_subgroup:{
					label:'Group',
					filter:1,
					hidden:1,
				},
				Age:{
					label:'age',
					filter:1,
				}
			}
		}
	},

	annotationsampleset2matrix:{
		key:'Genomic_subgroup',
		groups:{
		}
	},

	queries:{
		svcnv:{
			name:'AEL mutation & expression',
			showfullmode:true,
			istrack:true,
			type:common.tkt.mdssvcnv,
			file:'hg19/ael-mds/AEL.svcnv.gz',

			//cnv
			valueCutoff:0.2,
			bplengthUpperLimit:2000000, // limit cnv length to focal events

			groupsamplebyattr:{
				attrlst:[
					{k:'Genomic_subgroup',label:'Group',full:'Genomic_subgroup'}
				],
				sortgroupby:{
					key:'Genomic_subgroup',
					order:['TP53-mutated','NPM1-mutated','KMT2A-mutated','NUP98-rearranged','DDX41-mutated','Other']
				},
				attrnamespacer:', ',
			},

			expressionrank_querykey:'genefpkm',
			vcf_querykey:'snvindel',
			multihidelabel_vcf:true,
			multihidelabel_sv:true,
		},

		snvindel:{
			hideforthemoment:1,
			name:'AEL somatic SNV/indel',
			istrack:true,
			type:common.tkt.mdsvcf,
			viewrangeupperlimit:2000000,
			tracks:[
				{
					file:'hg19/ael-mds/AEL.snv.gz',
					type:'vcf',
				}
			]
		},

		genefpkm:{
			hideforthemoment:1,
			name:'AEL FPKM',
			isgenenumeric:true,
			file:'hg19/ael-mds/AEL.fpkm.gz',
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
				attributes:[
					{k:'Genomic_subgroup',label:'Group',full:'Genomic_subgroup'}
				]
			}
		}
		
	}
}
