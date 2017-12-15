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

const sample2tracks = {
	SJNBL046414_C1:[
		{type:'hicstraw',
		file:'files/hg19/nbl-hic/hic_SKNAS.inter.hic',
		name:'SJNBL046414_C1 Hi-C',
		maxpercentage:5,
		mincutoff:0,
		pyramidup:1,
		enzyme:'MboI',
		},
	],
	SJNBL046418_C1:[
		{type:'hicstraw',
		file:'files/hg19/nbl-hic/hic_NB69.inter.hic',
		name:'SJNBL046418_C1/SKNAS Hi-C',
		maxpercentage:5,
		mincutoff:0,
		pyramidup:1,
		enzyme:'MboI',
		},
	],
	SJNBL046420_C1:[
		{type:'hicstraw',
		file:'files/hg19/nbl-hic/hic_Kelly.inter.hic',
		name:'SJNBL046420_C1/Kelly Hi-C',
		maxpercentage:5,
		mincutoff:0,
		pyramidup:1,
		enzyme:'MboI',
		},
	],
	SJNBL046422_C1:[
		{type:'hicstraw',
		file:'files/hg19/nbl-hic/hic_BE2C.inter.hic',
		name:'SJNBL046422_C1/BE2C Hi-C',
		maxpercentage:5,
		mincutoff:0,
		pyramidup:1,
		enzyme:'MboI',
		},
	],
	SJNBL046424_C1:[
		{type:'hicstraw',
		file:'files/hg19/nbl-hic/hic_NGP.inter.hic',
		name:'SJNBL046424_C1/NGP Hi-C',
		maxpercentage:5,
		mincutoff:0,
		pyramidup:1,
		enzyme:'MboI',
		},
	],
	SJNBL046426_C1:[
		{type:'hicstraw',
		file:'files/hg19/nbl-hic/hic_SH-SY5Y.inter.hic',
		name:'SJNBL046426_C1/SH-SY5Y Hi-C',
		maxpercentage:5,
		mincutoff:0,
		pyramidup:1,
		enzyme:'MboI',
		},
	],
}


module.exports={

	genome:'hg19',
	isMds:true,
	about:[
		{k:'RNA splice junction',v:'RNA splice junctions'},
		{k:'CNV-SV',v:'Copy number variation events with supporting structural variation and gene expression ranking'}
	],
	dbFile:'anno/db/pediatric.hg19.db',

	sample2tracks:sample2tracks,

	cohort:{
		files:[
			// possible to have file-specific logic
			{file:'anno/db/pediatric.samples'},
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
		/*
		attributes:{
			lst:[
				{key:'diagnosis_group_short',label:'Cancer group',
					values:{
						BT:{label:"Brain Tumor"},
						HM:{label:"Hematopoietic Malignancies"},
						ST:{label:"Solid Tumor"},
					}
				},
				// cut -f6,7 ~/data/tp/anno/db/pediatric.samples|sort -u|awk '{FS="\t";printf("{%s:{label:\"%s\"}},\n"),$1,$2}'
				{key:'diagnosis_short',label:'Cancer type',
					values:{
						ACT:{label:"Adrenocortical Carcinoma"},
						AML:{label:"Acute Myeloid Leukemia"},
						BALL:{label:"B-cell Acute Lymphoblastic Leukemia"},
						CPC:{label:"Choroid Plexus Carcinoma"},
						EPD:{label:"Ependymoma"},
						EWS:{label:"Ewing's sarcoma"},
						HGG:{label:"High Grade Glioma"},
						LGG:{label:"Low Grade Glioma"},
						MB:{label:"Medulloblastoma"},
						MEL:{label:"Melanoma"},
						MLL:{label:"Mixed Lineage Leukemia"},
						NBL:{label:"Neuroblastoma"},
						OS:{label:"Osteosarcoma"},
						RB:{label:"Retinoblastoma"},
						RHB:{label:"Rhabdosarcoma"},
						TALL:{label:"T-cell Acute Lymphoblastic Leukemia"},
						WLM:{label:"Wilms' tumor"},
					}
				},
			],
			defaulthidden:{
				// only for sample annotations
				diagnosis_short:{
					BALL:1
				}
			}
		}
		*/
	},

	queries:{
		svcnv:{
			name:'Pediatric tumor somatic CNV+SV+LOH',
			istrack:true,
			type:common.tkt.mdssvcnv,
			file:'hg19/Pediatric/pediatric.svcnv.hg19.gz',

			// cnv
			valueCutoff:0.2,
			bplengthUpperLimit:2000000, // limit cnv length to focal events

			// loh
			segmeanValueCutoff:0.1,
			lohLengthUpperLimit:2000000,

			sortsamplebyhierarchy: {
				hierarchyidx:0, // array index of cohort.hierarchies.lst[]
				// TODO which level to look at
			},
			expressionrank_querykey:'genefpkm'
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

			boxplotbyhierarchy:{
				hierarchyidx:0
			},
			// yu's data & method for ase/outlier
			ase:{
				qvalue:0.05,
				meandelta_monoallelic:0.3,
				asemarkernumber_biallelic:0,
				meandelta_biallelic:0.1,
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
