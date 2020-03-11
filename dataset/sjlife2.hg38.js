const cohorthtmltable = `<table>
<thead>
  <tr>
    <td>Features</td>
	<td>St. Jude Lifetime Cohort Study (SJLIFE)</td>
	<td>Childhood Cancer Survivor Study (CCSS)</td>
  </tr>
</thead>
<tbody>
  <tr>
    <td>Survivors on Portal</td>
	<td>4402</td>
	<td>2936</td>
  </tr>
  <tr>
	<td>Years of cancer diagnosis</td>
	<td>1962-2012</td>
	<td>1987-1999 ("Expanded Cohort")</td>
  </tr>
  <tr>
	<td>Inclusion criteria</td>
	<td>Survived &ge; 5 years from diagnosis</td>
	<td>Survived &ge; 5 years from diagnosis</td>
  </tr>
  <tr>
	<td>Age at cancer diagnosis</td>
	<td><25 years</td>
	<td><21 years</td>
  </tr>
  <tr>
	<td>Cancer diagnosis</td>
	<td>All diagnoses</td>
	<td>Leukemia, CNS, HL, NHL, neuroblastoma, soft tissue sarcoma, Wilms, bone tumors</td>
  </tr>
  <tr>
	<td>Study design</td>
	<td>Retrospective cohort with prospective follow-up, hospital-based</td>
	<td>Retrospective cohort with prospective follow-up, hospital-based</td>
  </tr>
  <tr>
	<td>Methods of contact</td>
	<td>Clinic visits and surveys</td>
	<td>Surveys</td>
  </tr>
  <tr>
	<td>Source of sequenced germline DNA</td>
	<td>Blood</td>
	<td>Saliva or blood</td>
  </tr>
  <tr>
	<td>Therapeutic exposures</td>
	<td>Chemotherapy, radiation, surgery</td>
	<td>Chemotherapy, radiation, surgery</td>
  </tr>
  <tr>
	<td>Methods for ascertainment of outcomes</td>
	<td><span style="font-weight:bold;text-decoration:underline">Clinical assessments<span>, medical records, self-report, NDI</td>
	<td>Self-report, pathology reports, NDI</td>
  </tr>
</tbody>
</table>`

// the vcf file
const info_fields = [
	{
		key: 'QC',
		label: 'Good/Bad List',
		isfilter: true,
		isactivefilter: true,
		iscategorical: true,
		values: [
			{ key: 'SuperGood', label: 'SuperGood' },
			{ key: 'Good', label: 'Good' },
			{ key: 'Ambiguous', label: 'Ambiguous' },
			{ key: 'Bad', label: 'Bad', ishidden: true }
		]
	},
	{
		key: 'AF',
		label: 'SJLIFE allele frequency',
		isfilter: true,
		isfloat: 1,
		range: {
			startunbounded: true,
			stop: 1,
			stopinclusive: true
		}
	},
	{
		key: 'SJcontrol_AF',
		label: 'SJLIFE control allele frequency',
		isfilter: true,
		isfloat: 1,
		range: {
			startunbounded: true,
			stop: 1,
			stopinclusive: true
		}
	},
	{
		key: 'SJcontrol_CEU_AF',
		label: 'SJLIFE control allele frequency, Caucasian',
		isfilter: true,
		isfloat: 1,
		range: {
			startunbounded: true,
			stop: 1,
			stopinclusive: true
		}
	},
	{
		key: 'SJcontrol_YRI_AF',
		label: 'SJLIFE control allele frequency, African American',
		isfilter: true,
		isfloat: 1,
		range: {
			startunbounded: true,
			stop: 1,
			stopinclusive: true
		}
	},
	{
		key: 'SJcontrol_CR',
		label: 'SJLIFE control call rate',
		isfilter: true,
		isfloat: 1,
		range: {
			start: 0.95,
			startinclusive: true,
			stopunbounded: true
		}
	},
	{
		key: 'CR',
		label: 'SJLIFE call rate',
		isfilter: true,
		isactivefilter: true,
		isfloat: 1,
		range: {
			start: 0.95,
			startinclusive: true,
			stopunbounded: true
		}
	},
	{
		key: 'gnomAD_CR',
		label: 'gnmoAD call rate',
		isfilter: true,
		isactivefilter: true,
		isfloat: 1,
		range: {
			start: 0.95,
			startinclusive: true,
			stopunbounded: true
		}
	},
	{
		key: 'gnomAD_AF',
		label: 'gnomAD allele frequency',
		isfilter: true,
		isactivefilter: true,
		isfloat: 1,
		missing_value: 0,
		range: {
			start: 0.1,
			startinclusive: true,
			stop: 1,
			stopinclusive: true
		}
	},
	{
		key: 'gnomAD_AF_afr',
		label: 'gnomAD allele frequency, African-American',
		isfilter: true,
		isfloat: 1,
		missing_value: 0,
		range: {
			start: 0.1,
			startinclusive: true,
			stop: 1,
			stopinclusive: true
		}
	},
	{
		key: 'gnomAD_AF_eas',
		label: 'gnomAD allele frequency, East Asian',
		isfilter: true,
		isfloat: 1,
		missing_value: 0,
		range: {
			start: 0.1,
			startinclusive: true,
			stop: 1,
			stopinclusive: true
		}
	},
	{
		key: 'gnomAD_AF_nfe',
		label: 'gnomAD allele frequency, non-Finnish European',
		isfilter: true,
		isfloat: 1,
		missing_value: 0,
		range: {
			start: 0.1,
			startinclusive: true,
			stop: 1,
			stopinclusive: true
		}
	},
	{
		key: 'PG',
		label: 'Committee classification',
		iscategorical: true,
		isfilter: true,
		values: [{ key: 'P', label: 'Pathogenic' }, { key: 'LP', label: 'Likely pathogenic' }]
	},
	{
		key: 'BadBLAT',
		label: 'Paralog',
		isfilter: true,
		isactivefilter: true,
		isflag: true,
		remove_yes: true
	},
	{
		key: 'Polymer_region',
		label: 'Polymer region',
		isflag: true,
		isfilter: true,
		isactivefilter: true,
		remove_yes: true
	}
]

module.exports = {
	isMds: true,

	cohort: {
		db: {
			file: 'files/hg38/sjlife/clinical/db'
			// may describe keywords about table and field names
			/*
			k:{
				sample:'sample',
				term_id:'term_id'
			},
			*/
		},

		termdb: {
			//// this attribute is optional
			phewas: {
				samplefilter4termtype: {
					condition: {
						filter: {
							type: 'tvslst',
							join: '',
							in: true,
							lst: [{ type: 'tvs', tvs: { term: { id: 'ctcae_graded', type: 'categorical' }, values: [{ key: '1' }] } }]
						}
					}
				},
				comparison_groups: [
					/* only for condition terms
					 */
					{
						group1label: 'Grades 1-5',
						group1grades: new Set([1, 2, 3, 4, 5]),
						group2label: 'Condition not present'
						// group2 is not defined and will use the rest of the ctcae-graded samples
					},
					{
						group1label: 'Grades 2-5',
						group1grades: new Set([2, 3, 4, 5]),
						group2label: 'Condition not present',
						copycontrolfrom1stgroup: true
						/* group2 is still not defined, but here cannot simply use the rest of the ctcae-graded samples
						but must exclude grade 1 from group2
						as the control of the first group meets this requirement, thus this very tricky flag
						*/
					},
					{
						group1label: 'Grades 3-5',
						group1grades: new Set([3, 4, 5]),
						group2label: 'Condition not present',
						copycontrolfrom1stgroup: true
					}
					// to add later 1+2 vs 3+4+5
				]
			},

			//// this attribute is optional
			selectCohort: {
				// wrap term.id into a term json object so as to use it in tvs;
				// the term is not required to exist in termdb
				// term.id is specific to this dataset, should not use literally in client/server code but always through a variable
				term: {
					id: 'subcohort',
					type: 'categorical'
				},
				showMessageWhenNotSelected:
					'To get started with the Clinical Browser, select the survivor population you wish to browse.',
				values: [
					// <ul><li> for items, with a radio button for each.
					{
						keys: ['SJLIFE'],
						label: 'St. Jude Lifetime Cohort (SJLIFE)',
						isdefault: true,
						cssSelector: 'tbody > tr > td:nth-child(2)'
					},
					{
						keys: ['CCSS'],
						label: 'Childhood Cancer Survivor Study (CCSS)',
						cssSelector: 'tbody > tr > td:nth-child(3)'
					},
					{
						keys: ['SJLIFE', 'CCSS'],
						label: 'Combined SJLIFE+CCSS',
						cssSelector: 'tbody > tr > td:nth-child(2), tbody > tr > td:nth-child(3)',
						// show note under label in smaller text size
						note:
							'The combined cohorts are limited to those variables that are comparable between the two populations. For example, selecting this category does not allow browsing of clinically-ascertained variables, which are only available in SJLIFE.'
					}
				],
				highlightCohortBy: 'cssSelector',
				htmlinfo: cohorthtmltable
			}
		}
	},

	track: {
		name: 'SJLife germline SNV',

		info_fields,

		populations: [
			{
				key: 'gnomAD',
				label: 'gnomAD',
				allowto_adjust_race: true,
				adjust_race: true,
				termfilter: 'genetic_race',
				/*
				the "sets" is hardcoded to be based on a single attribute (race group)
				and does not allow another attribute e.g. sex
				*/
				sets: [
					// per variant, the control population allele counts are hardcoded to be info fields
					{
						key: 'CEU', // header of file "cohort/admix"
						infokey_AC: 'gnomAD_AC_nfe',
						infokey_AN: 'gnomAD_AN_nfe',
						termfilter_value: 'European Ancestry'
					},
					{
						key: 'YRI',
						infokey_AC: 'gnomAD_AC_afr',
						infokey_AN: 'gnomAD_AN_afr',
						termfilter_value: 'African Ancestry'
					},
					{
						key: 'ASA',
						infokey_AC: 'gnomAD_AC_eas',
						infokey_AN: 'gnomAD_AN_eas',
						termfilter_value: 'Asian Ancestry'
					}
				]
			},
			{
				key: 'SJControl',
				label: 'SJLIFE control',
				allowto_adjust_race: true,
				adjust_race: true,
				termfilter: 'genetic_race',
				sets: [
					{
						key: 'CEU',
						infokey_AC: 'SJcontrol_CEU_AC',
						infokey_AN: 'SJcontrol_CEU_AN',
						termfilter_value: 'European Ancestry'
					},
					{
						key: 'YRI',
						infokey_AC: 'SJcontrol_YRI_AC',
						infokey_AN: 'SJcontrol_YRI_AN',
						termfilter_value: 'African Ancestry'
					}
				]
			},
			{
				key: 'TOPMed',
				label: 'TOPMed',
				sets: [{ infokey_AC: 'TOPMed_AC', infokey_AN: 'TOPMed_AN' }]
			}
		],

		vcf: {
			file: 'files/hg38/sjlife/vcf/SJLIFE.vcf.gz',
			viewrangeupperlimit: 1000000,
			numerical_axis: {
				axisheight: 150,
				info_keys: [
					{
						key: 'AF',
						in_use: true
						// TODO bind complex rendering such as boxplot to one of the info fields
					},
					{ key: 'gnomAD_AF' },
					{ key: 'gnomAD_AF_afr' },
					{ key: 'gnomAD_AF_eas' },
					{ key: 'gnomAD_AF_nfe' },
					{ key: 'SJcontrol_AF' }
				],
				in_use: true, // to use numerical axis by default
				//inuse_infokey:true,
				inuse_AFtest: true,

				AFtest: {
					testby_AFdiff: false,
					testby_fisher: true,
					groups: [
						{
							is_termdb: true,
							filter: {
								type: 'tvslst',
								in: true,
								join: 'and',
								lst: [
									{
										type: 'tvs',
										renderAs: 'htmlSelect',
										selectOptionsFrom: 'selectCohort',
										tvs: {
											term: { id: 'subcohort', type: 'categorical' },
											values: [{ key: 'SJLIFE', label: 'SJLIFE' }]
										}
									},
									{
										type: 'tvs',
										tvs: {
											term: { id: 'diaggrp', name: 'Diagnosis Group', type: 'categorical' },
											values: [{ key: 'Acute lymphoblastic leukemia', label: 'Acute lymphoblastic leukemia' }]
										}
									}
								]
							}
						},
						{
							is_population: true,
							key: 'gnomAD',
							// these flags must be duplicated from .populations[]
							allowto_adjust_race: true,
							adjust_race: true
						}
					],
					allowed_infofields: [
						{ key: 'AF' },
						{ key: 'SJcontrol_AF' },
						{ key: 'gnomAD_AF' },
						{ key: 'gnomAD_AF_afr' },
						{ key: 'gnomAD_AF_eas' },
						{ key: 'gnomAD_AF_nfe' }
					],
					/*
					the termfilter hardcodes to be a single term
					may expands to termfilters[] to support multiple terms
					for selecting one as filter
					or even use two terms to combine
					*/
					termfilter: {
						id: 'genetic_race',
						name: 'Genetically defined race',
						type: 'categorical',
						// need to provide type/name/values besides id; in p4 with state rehydration, just need to provide term id
						values: [{ key: 'European Ancestry' }, { key: 'African Ancestry' }, { key: 'Asian Ancestry' }],
						inuse: true,
						value_index: 0
					}
				}
			},
			plot_mafcov: {
				show_samplename: 1
				// may allow jwt
			},
			termdb_bygenotype: {
				// this only works for stratifying samples by vcf genotype
				// svcnv or svcnv+snv combined may need its own trigger
				getAF: true,
				termid_sex: 'sex',
				value_male: 'Male',
				sex_chrs: ['chrX', 'chrY'],
				chr2par: {
					chrX: [{ start: 10000, stop: 2781478 }, { start: 155701382, stop: 156030894 }],
					chrY: [{ start: 10000, stop: 2781478 }, { start: 56887902, stop: 57217414 }]
				}
			},
			check_pecanpie: {
				info: {
					P: { fill: '#f04124', label: 'Pathogenic' },
					LP: { fill: '#e99002', label: 'Likely Pathogenic' },
					Uncertain: { fill: '#e7e7e7', label: 'Uncertain Pathogenicity', color: '#333' },
					U: { fill: '#e7e7e7', label: 'Uncertain Pathogenicity', color: '#333' },
					null: { fill: '#e7e7e7', label: 'Uncertain Pathogenicity', color: '#333' },
					LB: { fill: '#5bc0de', label: 'Likely Benign' },
					B: { fill: '#43ac6a', label: 'Benign' }
				}
			}
		},
		// to restrict samples
		sample_termfilter: {
			type: 'tvslst',
			join: '',
			in: true,
			lst: [
				{
					type: 'tvs',
					tvs: {
						term: {
							name: 'wgs',
							id: 'wgs_curated',
							type: 'categorical',
							// need to provide type/name/values besides id; in p4 with state rehydration, just need to provide term id
							values: { '0': { label: 'No' }, '1': { label: 'Yes' } }
						},
						values: [{ key: '1', label: 'Yes' }]
					}
				}
			]
		},
		ld: {
			tracks: [
				{
					name: 'SJLIFE European sub-cohort',
					file: 'files/hg38/sjlife/ld/CEU.gz',
					shown: false,
					viewrangelimit: 200000
				},
				{ name: 'SJLIFE African sub-cohort', file: 'files/hg38/sjlife/ld/YRI.gz', shown: false, viewrangelimit: 200000 }
			],
			overlay: {
				color_1: 'red',
				color_0: '#2E6594'
			}
		}
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
