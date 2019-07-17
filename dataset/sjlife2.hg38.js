

const samplenamekey = 'sjlid'



module.exports={

	isMds:true,



	cohort:{
		db:{
			file:'files/hg38/sjlife/clinical/db',
			// may describe keywords about table and field names
			k:{
				sample:'sample',
				term_id:'term_id'
			}
		},
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
			patient_condition:{
				// Note: this is solely for the "iscondition" terms
				file:'files/hg38/sjlife/clinical/outcomes_2017',
				events_key:'conditionevents',
				grade_key: 'grade',
				grade_labels: [ // computable grades
					{ grade: 1, label: '1: Mild' },
					{ grade: 2, label: '2: Moderate' },
					{ grade: 3, label: '3: Severe' },
					{ grade: 4, label: '4: Life-threatening' },
					{ grade: 5, label: '5: Death' }
				],
				uncomputable_grades: {
					0: 'No symptom',
					9: 'Unknown status'
				},
				age_key: 'age',
				yearstoevent_key:'yearstoevent'
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
					{ key:'SuperGood', label:'SuperGood' },
					{ key:'Good', label:'Good' },
					{ key:'Ambiguous', label:'Ambiguous' },
					{ key:'Bad', label:'Bad', ishidden:true }
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
				key:'SJcontrol_AF',
				label:'SJLIFE control allele frequency',
				isfilter:true,
				isfloat:1,
				range: {
					startunbounded:true,
					stop: 0.1,
					stopinclusive:true
				}
			},
			{
				key:'SJcontrol_CR',
				label:'SJLIFE control call rate',
				isfilter:true,
				isfloat:1,
				range: {
					start:0.95,
					startinclusive:true,
					stopunbounded:true,
				}
			},
			{
				key:'CR',
				label:'SJLIFE call rate',
				isfilter:true,
				isactivefilter:true,
				isfloat:1,
				range: {
					start: 0.95,
					startinclusive:true,
					stopunbounded:true,
				}
			},
			{
				key:'gnomAD_CR',
				label:'gnmoAD call rate',
				isfilter:true,
				isactivefilter:true,
				isfloat:1,
				range: {
					start: 0.95,
					startinclusive:true,
					stopunbounded:true,
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
				key:'PG',
				label:'Committee classification',
				iscategorical:true,
				isfilter:true,
				values:[
					{key:'P',label:'Pathogenic'},
					{key:'LP',label:'Likely pathogenic'},
				]
			},
			{
				key:'BadBLAT',
				label:'Paralog',
				isfilter:true,
				isactivefilter:true,
				isflag:true,
				remove_yes:true
			},
			{
				key:'Polymer_region',
				label:'Polymer region',
				isflag:true,
				isfilter:true,
				isactivefilter:true,
				remove_yes:true
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
			},
			{
				key:'SJControl',
				label:'SJLIFE control',
				sets:[ { infokey_AC:'SJcontrol_AC', infokey_AN:'SJcontrol_AN' } ]
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
					{ key:'gnomAD_AF_nfe' },
					{ key:'SJcontrol_AF' },
					{ key:'CR' },
					{ key:'gnomAD_CR' },
					{ key:'SJcontrol_CR' },
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
						{
							is_population:true, key:'gnomAD',
							// these flags must be duplicated from .populations[]
							allowto_adjust_race:true, adjust_race:true
						},
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
						{ key:'AF' },
						{ key:'SJcontrol_AF' },
						{ key:'gnomAD_AF' },
						{ key:'gnomAD_AF_afr' },
						{ key:'gnomAD_AF_eas' },
						{ key:'gnomAD_AF_nfe' }
					],
				},
			},
			plot_mafcov: {
				show_samplename: 1,
				// may allow jwt
			},
			termdb_bygenotype: {
				// this only works for stratifying samples by vcf genotype
				// svcnv or svcnv+snv combined may need its own trigger
				getAF:true,
				termid_sex: 'sex',
				value_male: 'Male',
				sex_chrs:['chrX','chrY'],
				chr2par:{
					'chrX':[{start:10000,stop:2781478},{start:155701382,stop:156030894}],
					'chrY':[{start:10000,stop:2781478},{start:56887902,stop:57217414}]
				}
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
		// to restrict samples 
		sample_termfilter:[{term:{id:'wgs_sequenced',iscategorical:true},values:[{key:'1'}]}],
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
