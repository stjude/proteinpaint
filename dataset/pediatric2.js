const common=require('../src/common')


const cohorthierarchy= [
	{k:'diagnosis_group_short',label:'Group',full:'diagnosis_group_full'},
	{k:'diagnosis_short',label:'Cancer',full:'diagnosis_full'},
	{k:'diagnosis_subtype_short',label:'Subtype',full:'diagnosis_subtype_full'},
	{k:'diagnosis_subgroup_short',label:'Subgroup',full:'diagnosis_subgroup_full'}
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
		{k:'RNA splice junction',v:'RNA splice junctions'},
		{k:'CNV-SV',v:'Copy number variation events with supporting structural variation and gene expression ranking'}
	],
	dbFile:'anno/db/pediatric.hg19.db',

	sampleAssayTrack:{
		file:'hg19/Pediatric/tracktable/__table'
	},

	cohort:{
		files:[
			// possible to have file-specific logic
			{file:'anno/db/pediatric.samples'},
			{file:'anno/db/pediatric.samples.2'},
			{file:'anno/db/target.samples'},
			{file:'anno/db/target.samples.tallsnp6array'},
			{file:'anno/db/nbl.cellline.samples'}
		],
		samplenamekey:samplenamekey,
		tohash:(item, ds)=>{
			ds.cohort.annotation[ item[samplenamekey] ] = item
		},
		hierarchies:{
			lst:[
				{
					name:'Cancer',
					levels:cohorthierarchy
				}
			]
		},
	},

	queries:{
		svcnv:{
			name:'Pediatric tumor somatic mutation',
			istrack:true,
			type:common.tkt.mdssvcnv,
			file:'hg19/Pediatric/pediatric.svcnv.hg19.gz',

			// cnv
			valueCutoff:0.2,
			bplengthUpperLimit:2000000, // limit cnv length to focal events

			// loh
			segmeanValueCutoff:0.1,
			lohLengthUpperLimit:2000000,

			/*
			the list of attributes to group samples, name of groups such as "HM, BALL"
			the attributes are hierarchical, when a sample is not annotated by 2nd attribute
			the sample will come to the bin of 1st attribute
			but if the sample is not annotated by 1st attribute, then it goes to a head-less bin, no matter if it's annotated by any subsequent attributes
			*/
			groupsamplebyattrlst:[ 
				{k:'diagnosis_group_short',label:'Group',full:'diagnosis_group_full'},
				{k:'diagnosis_short',label:'Cancer',full:'diagnosis_full'},
			],

			attrnamespacer:', ', // for making name e.g. "HM, BALL", will be propagated to the client-side track object

			expressionrank_querykey:'genefpkm',
			vcf_querykey:'somaticsnvindel'
		},
		somaticsnvindel:{
			name:'somatic SNV/indel',
			istrack:true,
			type:common.tkt.mdsvcf,
			tracks:[
				{file:'hg19/PCGP/vcf.somatic/652samples.vcf.gz'},
			]
		},
		genefpkm:{
			name:'Pediatric tumor RNA-seq gene FPKM',
			isgenenumeric:true,
			file:'hg19/Pediatric/pediatric.fpkm.hg19.gz',
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


			// yu's data & method for ase/outlier
			ase:{
				qvalue:0.05,
				meandelta_monoallelic:0.3,
				asemarkernumber_biallelic:0,
				//meandelta_biallelic:0.1,  no longer used
				color_noinfo:'#858585',
				color_notsure:'#A8E0B5',
				color_biallelic:'#40859C',
				color_monoallelic:'#d95f02'
			},
			outlier:{
				pvalue:0.05,
				color:'#FF8875'
			}
		},
		junction: {
			name:'PCGP tumor RNA splice junction',
			istrack:true,
			type:common.tkt.mdsjunction,
			viewrangeupperlimit:500000,
			readcountCutoff:5,
			file:'hg19/PCGP/junction/junction.gz',
			infoFilter:{ // client handles junction-level attributes
				lst:[
					{
						key:'type',
						label:'Type',
						categories:{
							canonical:{
								label:'Canonical',
								color:'#0C72A8'
							},
							exonskip:{
								label:'Exon skipping',
								color:'#D14747',
								valuePerSample:valuePerSample
							},
							exonaltuse:{
								label:'Exon alternative usage',
								color:'#E69525',
								valuePerSample:valuePerSample
							},
							a5ss:{
								label:'Alternative 5\' splice site',
								color:'#476CD1',
								valuePerSample:valuePerSample
							},
							a3ss:{
								label:'Alternative 3\' splice site',
								color:'#47B582',
								valuePerSample:valuePerSample
							},
							Unannotated:{
								label:'Not annotated',
								color:'#787854'
							}
						},
						hiddenCategories:{Unannotated:1}
					}
				]
			},
			singlejunctionsummary:{
				readcountboxplotpercohort:{
					// categorical attributes only
					groups:[
						{label:'Cancer group',key:'diagnosis_group_short'},
						{label:'Cancer', key:'diagnosis_short'}
					]
				}
			}
		}
	}
}
