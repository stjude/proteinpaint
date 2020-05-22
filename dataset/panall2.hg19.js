const common=require('../src/common')

const cohorthierarchy= [
	{k:'diagnosis_short',label:'Cancer',full:'diagnosis_full'},
	{k:'Fusion',label:'Subtype',full:'Fusion'}
]


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
		{k:'Cohort',v:'ALL cellline'},
		{k:'CNV',v:'Somatic copy number changes'},
		{k:'Fusion',v:'Tumor RNA-seq fusion'},
	],
	/*
	sampleAssayTrack:{
		file:'genomePaint_demo/tracktable/__table'
	},
	*/
	
	/*
	cohort and sample annotation
	*/
	cohort:{
		files:[
			{file:'hg19/panall2/sampletable/PanALL_SampleTable_GenomePaint_2020-5-13.txt'},
		],
		samplenamekey:samplenamekey,
		tohash:(item,ds)=>{
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
/*
		hierarchies:{
			lst:[
				{
					name:'Cancer',
					levels:cohorthierarchy
				}
			]
		},
*/
		sampleAttribute:{
			attributes:{
				diagnosis_group_short:{
					label:'Cancer group',
					filter:1,
					hidden:1,
				},
				diagnosis_short:{
					label:'Cancer',
					filter:1,
				},
				sample_type:{
					label:'Sample type',
					filter:1,
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
					snp:{ name:'SNP', label:'SNP6 array'},
				},
				hidden:1,
				filter:1
			}
		}
	},
	
	locusAttribute:{
		attributes:{
			COSMIC:{
				label:'COSMIC',
				appendto_link:'https://cancer.sanger.ac.uk/cosmic/mutation/overview?id='
			}
		}
	},

	queries:{
		svcnv:{
			name:'Demo mutation',
			istrack:true,
			type:common.tkt.mdssvcnv,
			file:'hg19/panall2/PanALL_CnvSvTable_GenomePaint_2020-5-13.svcnv.gz',

			// cnv
			valueCutoff:0.15, // 0.2 originally
			bplengthUpperLimit:5000000, // DON'T limit cnv length to focal events
	
			// loh
			segmeanValueCutoff:0.1,
			lohLengthUpperLimit:2000000,

			groupsamplebyattr:{
				attrlst:[
					{k:'diagnosis_short',label:'Cancer',full:'diagnosis_full'},
					{k:'Fusion',label:'Subtype',full:'Fusion'},				
				],
				attrnamespacer:', ',
			},
			//expressionrank_querykey:'genefpkm',
			//vcf_querykey:'snvindel',
			//multihidelabel_vcf:true,
			multihidelabel_fusion:false,
			//multihidelabel_sv:true,
			
		},

	}
}
