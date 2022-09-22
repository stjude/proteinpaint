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
	<td>4528</td>
	<td>2641</td>
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
	<td>Self-report, pathology reports (secondary neoplasm), NDI</td>
  </tr>
</tbody>
</table>`

/* when using snplocus term in regression analysis, restrict to an ancestry
each correspond to a tvs to be added for filtering samples
and the set of pc values to be used as co-variates
*/
const restrictAncestries = [
	{
		name: 'European ancestry',
		tvs: {
			term: {
				id: 'genetic_race',
				type: 'categorical',
				name: 'Genetically defined race'
			},
			values: [{ key: 'European Ancestry', label: 'European Ancestry' }]
		},
		// principal components as covariates in a model using genetic markers
		// 10 PCs for each sample, as 10 columns in each file
		PCcount: 10,
		PCfileBySubcohort: {
			SJLIFE: {
				file: 'files/hg38/sjlife/clinical/PCA/european.sjlife'
				// once loaded, pcs Map is attached here for each subcohort combination
			},
			CCSS: { file: 'files/hg38/sjlife/clinical/PCA/european.ccss' },
			'CCSS,SJLIFE': { file: 'files/hg38/sjlife/clinical/PCA/european.sjlife.ccss' }
		}
	},
	{
		name: 'African ancestry',
		tvs: {
			term: {
				id: 'genetic_race',
				type: 'categorical',
				name: 'Genetically defined race'
			},
			values: [{ key: 'African Ancestry', label: 'African Ancestry' }]
		},
		PCcount: 10,
		// a single pc file, not divided into subcohorts
		PCfile: 'files/hg38/sjlife/clinical/PCA/african.sjlife.ccss'
		// pcs Map is attached here
	}
]

// the vcf file
const info_fields = [
	{
		key: 'QC',
		label: 'classification',
		isfilter: true,
		isactivefilter: true,
		iscategorical: true,
		values: [{ key: 'Good', label: 'Good' }, { key: 'Bad', label: 'Bad', ishidden: true }]
	},
	{
		key: 'AF',
		label: 'Allele frequency, SJLIFE+CCSS',
		isfilter: true,
		isfloat: 1,
		range: {
			startunbounded: true,
			stop: 1,
			stopinclusive: true
		}
	},
	{
		key: 'AF_sjlife',
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
		key: 'AF_ccss',
		label: 'CCSS allele frequency',
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
		label: 'Call rate, SJLIFE+CCSS',
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
		key: 'CR_sjlife',
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
		key: 'CR_ccss',
		label: 'CCSS call rate',
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
		label: 'gnomAD call rate',
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
		key: 'Polymer_region',
		label: 'Polymer region',
		isflag: true,
		isfilter: true,
		isactivefilter: true,
		remove_yes: true
	}
]

const terms = [
	{
		id: 'QC',
		name: 'classification',
		parent_id: null,
		isleaf: true,
		type: 'categorical',
		values: {
			Good: { label: 'Good' },
			Bad: { label: 'Bad' }
		},
		tvs: {
			isnot: true,
			values: ['Bad']
		}
	},
	{
		id: 'AF',
		name: 'Allele frequency, SJLIFE+CCSS',
		parent_id: null,
		isleaf: true,
		type: 'float',
		min: 0,
		max: 1
	},
	{
		id: 'AF_sjlife',
		name: 'SJLIFE allele frequency',
		parent_id: null,
		isleaf: true,
		type: 'float',
		min: 0,
		max: 1
	},
	{
		id: 'AF_ccss',
		name: 'CCSS allele frequency',
		parent_id: null,
		isleaf: true,
		type: 'float',
		min: 0,
		max: 1
	},
	{
		id: 'SJcontrol_AF',
		name: 'SJLIFE control allele frequency',
		parent_id: null,
		isleaf: true,
		type: 'float',
		min: 0,
		max: 1
	},
	{
		id: 'SJcontrol_CEU_AF',
		name: 'SJLIFE control allele frequency, Caucasian',
		parent_id: null,
		isleaf: true,
		min: 0,
		max: 1,
		type: 'float'
	},
	{
		id: 'SJcontrol_YRI_AF',
		name: 'SJLIFE control allele frequency, African American',
		parent_id: null,
		isleaf: true,
		type: 'float',
		min: 0,
		max: 1
	},
	{
		id: 'SJcontrol_CR',
		name: 'SJLIFE control call rate',
		parent_id: null,
		isleaf: true,
		type: 'float',
		min: 0,
		max: 1,
		tvs: {
			ranges: [
				{
					start: 0.95,
					startinclusive: true,
					stopunbounded: true
				}
			]
		}
	},
	{
		id: 'CR',
		name: 'Call rate, SJLIFE+CCSS',
		parent_id: null,
		isleaf: true,
		type: 'float',
		min: 0,
		max: 1,
		tvs: {
			ranges: [
				{
					start: 0.95,
					startinclusive: true,
					stopunbounded: true
				}
			]
		}
	},
	{
		id: 'CR_sjlife',
		name: 'SJLIFE call rate',
		parent_id: null,
		isleaf: true,
		type: 'float',
		min: 0,
		max: 1,
		tvs: {
			ranges: [
				{
					start: 0.95,
					startinclusive: true,
					stopunbounded: true
				}
			]
		}
	},
	{
		id: 'CR_ccss',
		name: 'CCSS call rate',
		parent_id: null,
		isleaf: true,
		type: 'float',
		min: 0,
		max: 1,
		tvs: {
			ranges: [
				{
					start: 0.95,
					startinclusive: true,
					stopunbounded: true
				}
			]
		}
	},
	{
		id: 'gnomAD_CR',
		name: 'gnomAD call rate',
		parent_id: null,
		isleaf: true,
		type: 'float',
		min: 0,
		max: 1,
		tvs: {
			ranges: [
				{
					start: 0.95,
					startinclusive: true,
					stopunbounded: true
				}
			]
		}
	},
	{
		id: 'gnomAD_AF',
		name: 'gnomAD allele frequency',
		parent_id: null,
		isleaf: true,
		type: 'float',
		min: 0,
		max: 1,
		values: {
			//0: { label: 'missing value', uncomputable: true }
		},
		tvs: {
			ranges: [
				{
					start: 0.1,
					startinclusive: true,
					stopunbounded: true
				}
			]
		}
	},
	{
		id: 'gnomAD_AF_afr',
		name: 'gnomAD allele frequency, African-American',
		parent_id: null,
		isleaf: true,
		type: 'float',
		min: 0,
		max: 1,
		values: {
			//0: { label: 'missing value', uncomputable: true }
		}
	},
	{
		id: 'gnomAD_AF_eas',
		name: 'gnomAD allele frequency, East Asian',
		parent_id: null,
		isleaf: true,
		type: 'float',
		min: 0,
		max: 1,
		values: {
			//0: { label: 'missing value', uncomputable: true }
		}
	},
	{
		id: 'gnomAD_AF_nfe',
		name: 'gnomAD allele frequency, non-Finnish European',
		parent_id: null,
		isleaf: true,
		type: 'float',
		min: 0,
		max: 1,
		values: {
			//0: { label: 'missing value', uncomputable: true }
		}
	},
	{
		id: 'PG',
		name: 'Committee classification',
		parent_id: null,
		isleaf: true,
		type: 'categorical',
		values: {
			P: { label: 'Pathogenic' },
			LP: { label: 'Likely pathogenic' }
		}
	},
	{
		id: 'Polymer_region',
		name: 'Polymer region',
		parent_id: null,
		isleaf: true,
		type: 'categorical',
		values: {
			1: { label: 'yes' }
		},
		tvs: {
			isnot: true,
			values: [1]
		}
	}
]

terms.forEach(term => {
	if (!term.values) return
	for (const key in term.values) {
		const obj = term.values[key]
		if (!('key' in obj)) obj.key = key
	}
})

const lst = terms
	.filter(term => term.tvs)
	.map(_term => {
		const term = JSON.parse(JSON.stringify(_term))
		const item = {
			type: 'tvs',
			tvs: term.tvs
		}
		delete term.tvs
		item.tvs.term = term
		if (item.tvs.values) {
			const values = []
			for (const v of item.tvs.values) {
				if (typeof v == 'object') values.push(v)
				// v === the key reference in term.values
				else values.push(term.values[v])
			}
			item.tvs.values = values
		}
		return item
	})

const variant_filter = {
	opts: {
		joinWith: ['and']
	},
	// default active filter
	filter: {
		type: 'tvslst',
		join: lst.length > 1 ? 'and' : '',
		in: true,
		lst
	},
	// all info fields available to add to active filter
	terms
}

module.exports = {
	isMds: true,

	/* still only a quick fix
	sample2bam: {
		SJL5088613: 'files/hg38/sjlife/wgs-bam/SJST041646_G1.bam'
	},
	*/

	// may override the general rules in server/shared/termdb.usecase.js isUsableTerm()
	/*usecase: {
		regression(term, use) {}
	},*/

	cohort: {
		allowedChartTypes: ['barchart', 'cuminc', 'survival', 'regression'],

		db: {
			file: 'files/hg38/sjlife/clinical/db'
		},

		termdb: {
			// quick fix: list non-dictionary term types
			// expose to client via termdbConfig
			allowedTermTypes: [
				'snplst' // as independent variable in mass regression
				// to add 'snplocus' 'prs' later
			],

			timeScale: 'years',

			minTimeSinceDx: 5, // enrollment in sjlife requires 5 years since cancer diagnosis

			ageStartTermId: 'agedx', // term id for starting age of patients
			// for cox outcome with timeScale='age'
			// starting age of patients is age at cancer diagnosis

			ageEndOffset: 0.00274, // number of years to offset ending age of patients
			// for cox outcome with timeScale='age'
			// 1 day (i.e. 1/365 or 0.00274) needs to be added
			// to age_end to prevent age_end = age_start (which
			// would cause regression analysis to fail in R)

			coxCumincXlab: 'Years since study enrollment',

			restrictAncestries,

			//// this attribute is optional
			phewas: {
				/*
				this should be used for dataset without cohort selection
				samplefilter4termtype: {
					condition: {
						filter: {
							type: 'tvslst',
							join: 'or',
							in: true,
							lst: [
								{ type: 'tvs', tvs: { term: { id: 'ctcae_graded', type: 'categorical' }, values: [{ key: '1' }] } }
							]
						}
					}
				},
				*/

				/*
				when cohort selection is enabled, this is optional
				need this as not all sjlife samples are ctcae-graded, need to only use those graded ones in phewas
				this is only used in phewas precompute
				*/
				precompute_subcohort2totalsamples: {
					SJLIFE: {
						/*
						all: {
							filter: {
								type: 'tvslst',
								join: '',
								in: true,
								lst: [
									{ type: 'tvs', tvs: { term: { id: 'subcohort', type: 'categorical' }, values: [{ key: 'SJLIFE' }] } }
								]
							}
						},
						*/
						termtype: {
							condition: {
								filter: {
									type: 'tvslst',
									join: '',
									in: true,
									lst: [
										// this is based on the fact that ctcae_graded is only about sjlife samples, so no need to AND another tvs
										{ type: 'tvs', tvs: { term: { id: 'ctcae_graded', type: 'categorical' }, values: [{ key: '1' }] } }
									]
								}
							}
						}
					},
					/* no need to specify ccss as all its samples are supposed to be included	
					CCSS: {
						all: {
							filter: {
								type: 'tvslst',
								join: '',
								in: true,
								lst: [
									{ type: 'tvs', tvs: { term: { id: 'subcohort', type: 'categorical' }, values: [{ key: 'CCSS' }] } }
								]
							}
						}
					},
					*/
					'CCSS,SJLIFE': {
						/*
						all: {
							filter: {
								type: 'tvslst',
								join: '',
								in: true,
								lst: [
									{
										type: 'tvs',
										tvs: {
											term: { id: 'subcohort', type: 'categorical' },
											values: [{ key: 'SJLIFE' }, { key: 'CCSS' }]
										}
									}
								]
							}
						},
						*/
						termtype: {
							condition: {
								filter: {
									type: 'tvslst',
									join: 'or',
									in: true,
									lst: [
										// must include samples either is ctcae-graded, or is ccss
										{ type: 'tvs', tvs: { term: { id: 'subcohort', type: 'categorical' }, values: [{ key: 'CCSS' }] } },
										{ type: 'tvs', tvs: { term: { id: 'ctcae_graded', type: 'categorical' }, values: [{ key: '1' }] } }
									]
								}
							}
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
				title: 'Welcome to the St. Jude Survivorship Portal',
				description:
					'The St. Jude Survivorship Portal is a data portal for exploring, analyzing, visualizing, and downloading data from survivors of pediatric cancer. The portal hosts a variety of data types from cancer survivors, including demographic, cancer treatment, genetic, and clinical outcome data. These datasets were collected from two large-scale longitudinal studies of pediatric cancer survivors: the St. Jude Lifetime Cohort study (SJLIFE) and the Childhood Cancer Survivor Study (CCSS). Users can choose one or both of these cohorts to analyze in the portal. Once a cohort is selected, the user may then click on the "CHARTS" tab to explore, analyze, visualize, and download the data of this cohort.',
				prompt:
					'To get started, select a survivor cohort to analyze in the portal. Details about each cohort are provided in the table below.',
				values: [
					// <ul><li> for items, with a radio button for each.
					{
						keys: ['SJLIFE'],
						label: 'St. Jude Lifetime Cohort (SJLIFE)',
						shortLabel: 'SJLIFE',
						isdefault: true,
						cssSelector: 'tbody > tr > td:nth-child(2)'
					},
					{
						keys: ['CCSS'],
						label: 'Childhood Cancer Survivor Study (CCSS)',
						shortLabel: 'CCSS',
						cssSelector: 'tbody > tr > td:nth-child(3)'
					},
					{
						keys: ['SJLIFE', 'CCSS'],
						label: 'Combined SJLIFE+CCSS*',
						shortLabel: 'SJLIFE+CCSS',
						cssSelector: 'tbody > tr > td:nth-child(2), tbody > tr > td:nth-child(3)'
					}
				],
				asterisk:
					'*The combined cohort is limited to those variables that are comparable between SJLIFE and CCSS. For example, clinical assessment variables are not available for the combined cohort because they are only available for the SJLIFE cohort.',
				highlightCohortBy: 'cssSelector',
				htmlinfo: cohorthtmltable
			},
			helpPages: [
				// to use for help button in MASS UI
				// array of url links to help pages
				// if undefined, then help button will not appear
				{
					label: 'Survivorship portal tutorial',
					url: 'https://docs.google.com/document/d/1zofA9oRZMAOHb8WBPKWePMHLgyVeDuHXtadoTf_msRA/edit?usp=sharing'
				}
			]
		}
	},

	track: {
		name: 'Germline SNV',

		info_fields,
		variant_filter, // optional, if not available use {}

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
						termfilter_value: 'European Ancestry' // comment on usage
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
			chr2bcffile: {
				// all files MUST share the same header, and the same order of samples
				chr1: 'files/hg38/sjlife/bcf/INFOGT/chr1_SJLIFE_CCSS.GT.bcf.gz',
				chr2: 'files/hg38/sjlife/bcf/INFOGT/chr2_SJLIFE_CCSS.GT.bcf.gz',
				chr3: 'files/hg38/sjlife/bcf/INFOGT/chr3_SJLIFE_CCSS.GT.bcf.gz',
				chr4: 'files/hg38/sjlife/bcf/INFOGT/chr4_SJLIFE_CCSS.GT.bcf.gz',
				chr5: 'files/hg38/sjlife/bcf/INFOGT/chr5_SJLIFE_CCSS.GT.bcf.gz',
				chr6: 'files/hg38/sjlife/bcf/INFOGT/chr6_SJLIFE_CCSS.GT.bcf.gz',
				chr7: 'files/hg38/sjlife/bcf/INFOGT/chr7_SJLIFE_CCSS.GT.bcf.gz',
				chr8: 'files/hg38/sjlife/bcf/INFOGT/chr8_SJLIFE_CCSS.GT.bcf.gz',
				chr9: 'files/hg38/sjlife/bcf/INFOGT/chr9_SJLIFE_CCSS.GT.bcf.gz',
				chr10: 'files/hg38/sjlife/bcf/INFOGT/chr10_SJLIFE_CCSS.GT.bcf.gz',
				chr11: 'files/hg38/sjlife/bcf/INFOGT/chr11_SJLIFE_CCSS.GT.bcf.gz',
				chr12: 'files/hg38/sjlife/bcf/INFOGT/chr12_SJLIFE_CCSS.GT.bcf.gz',
				chr13: 'files/hg38/sjlife/bcf/INFOGT/chr13_SJLIFE_CCSS.GT.bcf.gz',
				chr14: 'files/hg38/sjlife/bcf/INFOGT/chr14_SJLIFE_CCSS.GT.bcf.gz',
				chr15: 'files/hg38/sjlife/bcf/INFOGT/chr15_SJLIFE_CCSS.GT.bcf.gz',
				chr16: 'files/hg38/sjlife/bcf/INFOGT/chr16_SJLIFE_CCSS.GT.bcf.gz',
				chr17: 'files/hg38/sjlife/bcf/INFOGT/chr17_SJLIFE_CCSS.GT.bcf.gz',
				chr18: 'files/hg38/sjlife/bcf/INFOGT/chr18_SJLIFE_CCSS.GT.bcf.gz',
				chr19: 'files/hg38/sjlife/bcf/INFOGT/chr19_SJLIFE_CCSS.GT.bcf.gz',
				chr20: 'files/hg38/sjlife/bcf/INFOGT/chr20_SJLIFE_CCSS.GT.bcf.gz',
				chr21: 'files/hg38/sjlife/bcf/INFOGT/chr21_SJLIFE_CCSS.GT.bcf.gz',
				chr22: 'files/hg38/sjlife/bcf/INFOGT/chr22_SJLIFE_CCSS.GT.bcf.gz',
				chrX: 'files/hg38/sjlife/bcf/INFOGT/chrX_SJLIFE_CCSS.GT.bcf.gz',
				chrY: 'files/hg38/sjlife/bcf/INFOGT/chrY_SJLIFE_CCSS.GT.bcf.gz'
			},

			// optional setting
			// for now put the AD bcf files here, to be used by mafcov plot
			AD: {
				chr2bcffile: {
					chr1: 'files/hg38/sjlife/bcf/AD/chr1_SJLIFE_CCSS.AD.NoINFO.bcf.gz',
					chr2: 'files/hg38/sjlife/bcf/AD/chr2_SJLIFE_CCSS.AD.NoINFO.bcf.gz',
					chr3: 'files/hg38/sjlife/bcf/AD/chr3_SJLIFE_CCSS.AD.NoINFO.bcf.gz',
					chr4: 'files/hg38/sjlife/bcf/AD/chr4_SJLIFE_CCSS.AD.NoINFO.bcf.gz',
					chr5: 'files/hg38/sjlife/bcf/AD/chr5_SJLIFE_CCSS.AD.NoINFO.bcf.gz',
					chr6: 'files/hg38/sjlife/bcf/AD/chr6_SJLIFE_CCSS.AD.NoINFO.bcf.gz',
					chr7: 'files/hg38/sjlife/bcf/AD/chr7_SJLIFE_CCSS.AD.NoINFO.bcf.gz',
					chr8: 'files/hg38/sjlife/bcf/AD/chr8_SJLIFE_CCSS.AD.NoINFO.bcf.gz',
					chr9: 'files/hg38/sjlife/bcf/AD/chr9_SJLIFE_CCSS.AD.NoINFO.bcf.gz',
					chr10: 'files/hg38/sjlife/bcf/AD/chr10_SJLIFE_CCSS.AD.NoINFO.bcf.gz',
					chr11: 'files/hg38/sjlife/bcf/AD/chr11_SJLIFE_CCSS.AD.NoINFO.bcf.gz',
					chr12: 'files/hg38/sjlife/bcf/AD/chr12_SJLIFE_CCSS.AD.NoINFO.bcf.gz',
					chr13: 'files/hg38/sjlife/bcf/AD/chr13_SJLIFE_CCSS.AD.NoINFO.bcf.gz',
					chr14: 'files/hg38/sjlife/bcf/AD/chr14_SJLIFE_CCSS.AD.NoINFO.bcf.gz',
					chr15: 'files/hg38/sjlife/bcf/AD/chr15_SJLIFE_CCSS.AD.NoINFO.bcf.gz',
					chr16: 'files/hg38/sjlife/bcf/AD/chr16_SJLIFE_CCSS.AD.NoINFO.bcf.gz',
					chr17: 'files/hg38/sjlife/bcf/AD/chr17_SJLIFE_CCSS.AD.NoINFO.bcf.gz',
					chr18: 'files/hg38/sjlife/bcf/AD/chr18_SJLIFE_CCSS.AD.NoINFO.bcf.gz',
					chr19: 'files/hg38/sjlife/bcf/AD/chr19_SJLIFE_CCSS.AD.NoINFO.bcf.gz',
					chr20: 'files/hg38/sjlife/bcf/AD/chr20_SJLIFE_CCSS.AD.NoINFO.bcf.gz',
					chr21: 'files/hg38/sjlife/bcf/AD/chr21_SJLIFE_CCSS.AD.NoINFO.bcf.gz',
					chr22: 'files/hg38/sjlife/bcf/AD/chr22_SJLIFE_CCSS.AD.NoINFO.bcf.gz',
					chrX: 'files/hg38/sjlife/bcf/AD/chrX_SJLIFE_CCSS.AD.NoINFO.bcf.gz',
					chrY: 'files/hg38/sjlife/bcf/AD/chrY_SJLIFE_CCSS.AD.NoINFO.bcf.gz'
				}
				// other attr will be added when dataset is initiated
			},

			viewrangeupperlimit: 1000000,
			numerical_axis: {
				in_use: true, // to use numerical axis by default
				//inuse_infokey:true,
				inuse_AFtest: true,

				axisheight: 150,
				info_keys: [
					{
						key: 'AF',
						in_use: true
						// TODO bind complex rendering such as boxplot to one of the info fields
					},
					{ key: 'AF_sjlife' },
					{ key: 'AF_ccss' },
					{ key: 'gnomAD_AF' },
					{ key: 'gnomAD_AF_afr' },
					{ key: 'gnomAD_AF_eas' },
					{ key: 'gnomAD_AF_nfe' },
					{ key: 'SJcontrol_AF' }
				],

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
										tag: 'cohortFilter',
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
						{ key: 'AF_sjlife' },
						{ key: 'AF_ccss' },
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
		// optional; a hidden TVS to restrict samples, will not be rendered in UI
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
							type: 'categorical'
							// no need to provide values as it will not be rendered on frontend
						},
						values: [{ key: '1', label: 'Yes' }]
					}
				}
			]
		},
		ld: {
			tracks: [
				{
					name: 'European ancestry',
					file: 'files/hg38/sjlife/ld/CEU.gz',
					shown: false,
					viewrangelimit: 200000
				},
				{ name: 'African ancestry', file: 'files/hg38/sjlife/ld/YRI.gz', shown: false, viewrangelimit: 200000 }
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
