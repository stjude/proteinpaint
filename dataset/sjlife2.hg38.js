

const samplenamekey = 'sjlid'



module.exports={

	isMds:true,



	cohort:{
		files:[
			{file:'files/hg38/sjlife/clinical/matrix'},
			{file:'files/hg38/sjlife/cohort/admix'}
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
			]
		},
	},




	// mds2 track
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
						key:'Good',
						label:'Good'
					},
					{
						key:'Bad',
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
					//startinclusive: bool
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
				range: {
					start: 0.1,
					startinclusive: true,
					stop: 1,
					stopinclusive:true
				}
			},
			{
				key:'gnomAD_AF_afr',
				label:'gnomAD African-American allele frequency',
				isfilter:true,
				isfloat:1,
				range: {
					start: 0.1,
					startinclusive: true,
					stop: 1,
					stopinclusive:true
				}
			},
			{
				key:'gnomAD_AF_eas',
				label:'gnomAD East Asian allele frequency',
				isfilter:true,
				isfloat:1,
				range: {
					start: 0.1,
					startinclusive: true,
					stop: 1,
					stopinclusive:true
				}
			},
			{
				key:'gnomAD_AF_nfe',
				label:'gnomAD non-Finnish European allele frequency',
				isfilter:true,
				isfloat:1,
				range: {
					start: 0.1,
					startinclusive: true,
					stop: 1,
					stopinclusive:true
				}
			},
			{
				key:'BadBLAT',
				isflag:true,
				isfilter:true,
				isactivefilter:true,
				remove_yes:true
			},
			/*
			{
				key:'DB',
				label:'dbSNP membership',
				isflag:true,
				isfilter:true,
				isactivefilter:true,
				remove_no:true
			},
			*/
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
						// TODO bind complex things such as boxplot to one of the info fields
					},
					{ key:'gnomAD_AF', missing_value: 0, },
					{ key:'gnomAD_AF_afr', missing_value: 0, },
					{ key:'gnomAD_AF_eas', missing_value: 0, },
					{ key:'gnomAD_AF_nfe', missing_value: 0, }
				],
				in_use: true, // to use numerical axis by default

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
						{
							term:{id:'diaggrp',name:'Diagnosis Group', iscategorical:true },
							values:[ {key:'Acute lymphoblastic leukemia',label:'Acute lymphoblastic leukemia'} ]
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
