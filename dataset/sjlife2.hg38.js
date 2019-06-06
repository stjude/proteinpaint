

const samplenamekey = 'sjlid'



module.exports={

	isMds:true,



	cohort:{
		files:[
			{file:'files/hg38/sjlife/clinical/matrix'},
			{file:'files/hg38/sjlife/cohort/admix'},
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

		sampleAttribute: {
			attributes: {
				CEU: {
					label:'Non-finish European',
					isfloat:1
				},
				YRI: {
					label:'African American',
					isfloat:1
				},
				ASA: {
					label:'East Asian',
					isfloat:1
				},
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
			],
			patient_condition:{
				file:'files/hg38/sjlife/clinical/outcomes_2017',
				events_key:'conditionevents',
				grade_key:'grade',
				age_key:'age',
				// additional configs for charts and tables
			}
		},
	},




	track: {
		name:'SJLife germline SNV',

		info_fields: [
			{
				key:'QC',
				label:'Good/Bad List',
				isfilter:true,
				isactivefilter:true,
				iscategorical:true,
				values:[
					{
						key:'good',
						label:'Good'
					},
					{
						key:'bad',
						label:'Bad',
						ishidden:true
					}
				]
			},
			{
				key:'AF',
				label:'SJLIFE allele frequency',
				isfilter:true,
				isfloat:1,
				range: {
					startunbounded:true,
					stop: 0.1,
					stopinclusive:true
				}
			},
			{
				key:'gnomAD_AF',
				label:'gnomAD allele frequency',
				isfilter:true,
				isactivefilter:true,
				isfloat:1,
				missing_value:0,
				range: {
					start: 0.1,
					startinclusive: true,
					stop: 1,
					stopinclusive:true
				}
			},
			{
				key:'gnomAD_AF_afr',
				label:'gnomAD allele frequency, African-American',
				isfilter:true,
				isfloat:1,
				missing_value:0,
				range: {
					start: 0.1,
					startinclusive: true,
					stop: 1,
					stopinclusive:true
				}
			},
			{
				key:'gnomAD_AF_eas',
				label:'gnomAD allele frequency, East Asian',
				isfilter:true,
				isfloat:1,
				missing_value:0,
				range: {
					start: 0.1,
					startinclusive: true,
					stop: 1,
					stopinclusive:true
				}
			},
			{
				key:'gnomAD_AF_nfe',
				label:'gnomAD allele frequency, non-Finnish European',
				isfilter:true,
				isfloat:1,
				missing_value:0,
				range: {
					start: 0.1,
					startinclusive: true,
					stop: 1,
					stopinclusive:true
				}
			},
			{
				key:'BadBLAT',
				label:'Bad blat',
				isflag:true,
				isfilter:true,
			},
		],


		populations:[
			{
				key:'gnomAD',
				label:'gnomAD',
				allowto_adjust_race:true,
				adjust_race:true,
				sets:[
					// per variant, the control population allele counts are hardcoded to be info fields
					{
						key:'CEU', // header of file "cohort/admix"
						infokey_AC: 'gnomAD_AC_nfe',
						infokey_AN: 'gnomAD_AN_nfe'
					},
					{
						key:'YRI',
						infokey_AC: 'gnomAD_AC_afr',
						infokey_AN: 'gnomAD_AN_afr'
					},
					{
						key:'ASA',
						infokey_AC: 'gnomAD_AC_eas',
						infokey_AN: 'gnomAD_AN_eas'
					}
				],
			}
		],


		vcf: {
			file:'files/hg38/sjlife/vcf/SJLIFE.vcf.gz',
			viewrangeupperlimit: 1000000,
			numerical_axis: {
				axisheight: 150,
				info_keys: [
					{
						key:'AF',
						in_use:true,
						// TODO bind complex rendering such as boxplot to one of the info fields
					},
					{ key:'gnomAD_AF' },
					{ key:'gnomAD_AF_afr' },
					{ key:'gnomAD_AF_eas' },
					{ key:'gnomAD_AF_nfe' }
				],
				in_use: true, // to use numerical axis by default
				//inuse_infokey:true,
				inuse_AFtest:true,

				AFtest:{
					testby_AFdiff:false,
					testby_fisher:true,
					groups:[
						{
							is_termdb:true,
							terms:[
								{
									term: { id:'diaggrp', name:'Diagnosis Group', iscategorical:true },
									values:[
										{ key:'Acute lymphoblastic leukemia',label:'Acute lymphoblastic leukemia'},
									]
								}
							]
						},
						{ is_population:true, key:'gnomAD', adjust_race:true },
						/*
						{
							is_termdb:true,
							terms:[
								{
									term: { id:'diaggrp', name:'Diagnosis Group', iscategorical:true },
									values:[
										{key:'Neuroblastoma',label:'Neuroblastoma'}
									]
								}
							]
						},
						{ is_infofield:true, key:'gnomAD_AF' },
						{ is_infofield:true, key:'gnomAD_AF_afr' },
						*/
					],
					allowed_infofields:[
						{ key:'gnomAD_AF' },
						{ key:'gnomAD_AF_afr' },
						{ key:'gnomAD_AF_eas' },
						{ key:'gnomAD_AF_nfe' }
					],
					allowed_populations:[ 'gnomAD' ]
				},








				termdb2groupAF:{
					group1:{
						name:'GROUP 1',
						terms:[
							{
							term: { id:'diaggrp', name:'Diagnosis Group', iscategorical:true },
							values:[
								{ key:'Acute lymphoblastic leukemia',label:'Acute lymphoblastic leukemia'},
								{key:'Neuroblastoma',label:'Neuroblastoma'}
							]
							}
						]
					},
					group2:{
						name:'GROUP 2',
						terms:[
							{
							term: { id:'diaggrp', name:'Diagnosis Group', iscategorical:true },
							values:[ {key:'Acute lymphoblastic leukemia',label:'Acute lymphoblastic leukemia'} ],
							isnot: true,
							}
						]
					}
				},

				ebgatest: {
					terms:[
					/*
						{
							term:{id:'diaggrp',name:'Diagnosis Group', iscategorical:true },
							values:[ {key:'Acute lymphoblastic leukemia',label:'Acute lymphoblastic leukemia'} ]
						}
						*/
						{
							term:{id:'agedx',name:'Age at dx',isfloat:true},
							range:{
								start:0,
								stop:4,
								startinclusive:true,
								stopinclusive:true
							}
						}
					],
					populations:[
						// per variant, the control population allele counts are hardcoded to be info fields
						{
							key:'CEU',
							infokey_AC: 'gnomAD_AC_nfe',
							infokey_AN: 'gnomAD_AN_nfe'
						},
						{
							key:'YRI',
							infokey_AC: 'gnomAD_AC_afr',
							infokey_AN: 'gnomAD_AN_afr'
						},
						{
							key:'ASA',
							infokey_AC: 'gnomAD_AC_eas',
							infokey_AN: 'gnomAD_AN_eas'
						}
					]
				},
			},
			plot_mafcov: {
				show_samplename: 1
				// may allow jwt
			},
			termdb_bygenotype: {
				// this only works for stratifying samples by mutation genotype
				// svcnv or svcnv+snv combined may need its own trigger
			},
			check_pecanpie: {
				info: {
					P: {fill:"#f04124", label:"Pathogenic"},
					LP: {fill:"#e99002", label:"Likely Pathogenic"},
					Uncertain: {fill:"#e7e7e7", label:"Uncertain Pathogenicity", color:'#333'},
					U: {fill:"#e7e7e7", label:"Uncertain Pathogenicity", color:'#333'},
					"null": {fill:"#e7e7e7", label:"Uncertain Pathogenicity",color:'#333'},
					LB:{fill: "#5bc0de", label:"Likely Benign"},
					B: {fill:"#43ac6a", label:"Benign"}
				}
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
