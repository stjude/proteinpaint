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
	//noHandleOnClient:true,  // to hide handle on client

	about:[
		{k:'Cohort',v:'PCGP and TARGET'},
		{k:'CNV',v:'Somatic copy number changes'},
		{k:'LOH',v:'Somatic copy-neutral LOH'},
		{k:'SV',v:'Somatic DNA structural variation'},
		{k:'Fusion',v:'Tumor RNA-seq fusion'},
		{k:'ITD',v:'ITD from either RNA or DNA'},
		{k:'SNV/indel',v:'Somatic mutations of tumor, and germline pathogenic mutations'},
		{k:'RNA splice junction',v:'Tumor RNA splice junctions'},
	],

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
			{file:'anno/db/pedccl.celllines'}
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


	/*
	mutation-level attributes, applied to multiple data types
	design issue:
	1. attributes are sample-level, applied to per-sample cases as lines in svcnv file, and FORMAT in vcf,
	   so as one vcf variant can be in multiple samples, each case discovered by different assay types (wgs/wes) by different lab
	2. when representing annotation by these attributes on client, do not indicate items that are Unannotated
	3. when filtering to hide items by attributes, do not hide *unannotated* items
	   case for conscern: sv & fusion are both present, sv is annotated by dna_assay; fusion by rna_assay
	   if showing only "polyA" for rna_assay, all sv won't have such annotation, but they should not be dropped
	   problem is no way to "scope" rna_assay filtering only within RNA-based variants
	*/
	mutationAttribute:{
		attributes:{
			dna_assay:{
				label:'DNA assay',
				values:{
					cgi:{ name:'CGI',label:'Complete Genomics whole-genome sequencing', },
					wgs:{ name:'WGS',label:'Whole-genome sequencing' },
					wes:{ name:'WES',label:'Whole-exome sequencing'},
					snp6:{ name:'SNP6',label:'SNP Array 6.0'}
				},
				hidden:1,
				filter:1
			},
			rna_assay:{
				label:'RNA assay',
				values:{
					total:{ name:'Total RNA'},
					polya:{ name:'Poly(A)-selected'},
				},
				hidden:1,
				filter:1
			},
			project:{
				label:'Project',
				values:{
					pantarget:{ name:'Pan-TARGET', label:'Pan-cancer analysis of the NCI TARGET dataset'},
					pcgp:{ name:'PCGP',label:'Pediatric Cancer Genome Project'},
					pedccl:{name:'PedCCL',label:'Pediatric Cancer Cell Lines'}
				},
				filter:1
			},
			vorigin:{
				label:'Variant origin',
				values:{
					somatic:{name:'Somatic'},
					germline:{name:'Germline'}
				},
				filter:1
			},
			pmid:{
				label:'PubMed',
				appendto_link:'http://www.ncbi.nlm.nih.gov/pubmed/'
			}
		}
	},


	/*
	in svcnv track, sample groups (HM, BALL) are defined by annotation attributes (groupsamplebyattrlst)
	such a group can get a preconfigured samplematrix
	key the matrix to the sample group by just one attribute
	*/
	annotationsampleset2matrix: {
		key:'diagnosis_short',
		// key for sample attribute
		groups:{
			// key is value for annotationkey
			BALL:{
				features:[
					{ismutation:1,genename:'ETV6',position:'chr12:11802788-12048325',querykeylst:['svcnv','snvindel']},
					{ismutation:1,genename:'RUNX1',position:'chr21:36160098-36421595',querykeylst:['svcnv','snvindel']},
					{ismutation:1,genename:'KRAS',position:'chr12:25357723-25403865',querykeylst:['svcnv','snvindel']},
					{ismutation:1,genename:'NRAS',position:'chr1:115247085-115259515',querykeylst:['svcnv','snvindel']},
					{ismutation:1,genename:'JAK2',position:'chr9:4985245-5128183',querykeylst:['svcnv','snvindel']},
				],
				limitsamplebyeitherannotation:[ {key:'diagnosis_short',value:'BALL'} ],
			}
		}
	},

/************* not ready to migrate to general track yet
	key2generalTracks:{
		pedmut: {
			label:'Pediatric cancer mutation',
			querykeys: [
				{key:'svcnv'},
				{key:'snvindel'},
				{key:'genefpkm'}
			]
		}
	},
	*/

	queries:{

		svcnv:{
			name:'Pediatric tumor mutation',
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

			/*
			to sort sample groups consistently, on client, not on server
			*/
			sortgroupby:{
				key:'diagnosis_group_short',
				order:['ST','BT','HM']
			},

			attrnamespacer:', ', // for making name e.g. "HM, BALL", will be propagated to the client-side track object


			expressionrank_querykey:'genefpkm',
			vcf_querykey:'snvindel',

			multihidelabel_vcf:true,
			multihidelabel_fusion:false,
			multihidelabel_sv:true,
		},



		snvindel:{
			hideforthemoment:1,
			name:'Pediatric tumor SNV/indel',
			istrack:true,
			type:common.tkt.mdsvcf,
			viewrangeupperlimit:2000000,
			tracks:[
				{
					file:'hg19/PCGP/vcf.somatic/pcgp.somatic.vcf.gz',
					type:'vcf',
				},
				{
					file:'hg19/PCGP/vcf.germline/NEJMGermline_sorted.vep.out.vcf.gz',
					type:'vcf',
				},
				{
					file:'hg19/TARGET/vcf.somatic/target.vep.vcf.gz',
					type:'vcf',
				},
			]
		},



		genefpkm:{
			hideforthemoment:1,
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
