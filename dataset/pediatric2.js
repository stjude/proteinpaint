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


	/*
	cohort and sample annotation
	*/
	cohort:{
		files:[
			{file:'anno/db/pediatric.samples'},
			{file:'anno/db/pediatric.samples.2'},
			{file:'anno/db/target.samples'},
			{file:'anno/db/target.samples.tallsnp6array'},
			{file:'anno/db/pedccl.celllines'},
			{file:'anno/db/pcgp.telomerecall'}
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
		hierarchies:{
			lst:[
				{
					name:'Cancer',
					levels:cohorthierarchy
				}
			]
		},
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
				'WGS telomere call':{
					label:'WGS telomere call',
					values:{
						GAIN:{ name:'Gain',color:'red'},
						LOSS:{ name:'Loss',color:'blue'},
						NO_CHANGE:{name:'No change',color:'gray'}
					}
				}
			},
		}
	},



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


	annotationsampleset2matrix: {
		key:'diagnosis_short',
		commonfeatureattributes:{
			querykeylst:['svcnv','snvindel'],
			cnv:{
				valuecutoff:0.2,
				focalsizelimit:2000000,
			},
			loh:{
				valuecutoff:0.1,
				focalsizelimit:2000000,
			},
			snvindel:{
				excludeclasses:{
					E:1,
					Intron:1,
					X:1,
					noncoding:1
				}
			}
		},
		groups:{
			"BALL":{
				groups:[
					{
						name:'Ph-like',
						matrixconfig:{
							header:'<h3>Targetable kinase-activating lesions in Ph-like acute lymphoblastic leukemia</h3>',
							hidelegend_features:1,
							features:[
								{ismutation:1,label:'ABL1',position:'chr9:133710642-133763062'},
								{ismutation:1,label:'ABL2',position:'chr1:179068461-179198819'},
								{ismutation:1,label:'CSF1R',position:'chr5:149432853-149492935'},
								{ismutation:1,label:'PDGFRB',position:'chr5:149493399-149535435'},
								{ismutation:1,label:'JAK2',position:'chr9:4985032-5128183'},
								//{ismutation:1,label:'',position:''},
							],
							limitsamplebyeitherannotation:[ {key:'diagnosis_subtype_short',value:'PH-LIKE'} ],
						}
					},
				]
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

			groupsamplebyattr:{ 
				attrlst:[
					{k:'diagnosis_group_short',label:'Group',full:'diagnosis_group_full'},
					{k:'diagnosis_short',label:'Cancer',full:'diagnosis_full'},
				],
				sortgroupby:{
					key:'diagnosis_group_short',
					order:['ST','BT','HM']
				},
				attrnamespacer:', ',
			},




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
