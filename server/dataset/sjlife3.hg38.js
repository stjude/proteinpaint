const selectCohort = {
	term: {
		id: 'subcohort',
		type: 'categorical'
	},
	title: 'Welcome to the St. Jude Survivorship Portal',
	description: `The St. Jude Survivorship Portal is a data portal for exploring, analyzing, and sharing data from survivors of pediatric cancer. The portal hosts a wide range of data types collected from cancer survivors, including demographic, genetic, cancer treatment, clinical outcome, and patient-reported data. These datasets were generated by two large-scale longitudinal studies of pediatric cancer survivors: the <a href='https://sjlife.stjude.org/' target='_blank'>St. Jude Lifetime Cohort Study (SJLIFE)</a> and the <a href='https://ccss.stjude.org/' target='_blank'>Childhood Cancer Survivor Study (CCSS)</a>. Users may select one or both of these cohorts to analyze on the portal. The data of each cohort is organized hierarchically in a data dictionary that can be explored by the user. This data can be summarized and visualized using bar charts or analyzed using statistical analyses, such as cumulative incidence analyses and regression analyses. The raw data of each cohort may also be downloaded by the user for further use.`,
	prompt: `To get started, select a survivor cohort to analyze in the portal. Once a cohort is selected, click on the "CHARTS" tab at the top to explore and analyze the data of this cohort.`,
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
	highlightCohortBy: 'cssSelector'
}

const dataDownloadCatch = {
	helpLink: 'https://university.stjude.cloud/docs/visualization-community/data-download/',
	missingAccess: {
		message:
			"You are missing approval to one or more of the required datasets. Please go to <a target=_blank href='MISSING-ACCESS-LINK'>Genomics Platform Data Browser</a> to request access. For more information, please see this <a target=_blank href='https://university.stjude.cloud/docs/visualization-community/data-download/'>tutorial.</a>",
		links: {
			sjlife: 'https://platform.stjude.cloud/data/cohorts?selected_tags=SJC-DS-1002',
			ccss: 'https://platform.stjude.cloud/data/cohorts?selected_tags=SJC-DS-1005',
			'sjlife,ccss': 'https://platform.stjude.cloud/data/cohorts?selected_tags=SJC-DS-1002,SJC-DS-1005'
		}
	},
	jwt: {
		'Invalid token': 'https://university.stjude.cloud/docs/visualization-community/data-download/'
	}
}

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

// why is key needed? values:{ 1: {key:1, label:'yes'}}
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

const defaultGroups = [
	{
		// type=filter: user can modify via filterUI
		type: 'filter',
		filter: {
			type: 'tvslst',
			in: true,
			join: '',
			lst: [
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
		// type=population: a choice from queries.snvindel.populations
		type: 'population',
		key: 'gnomAD',
		// these flags must be duplicated from .populations[]
		allowto_adjust_race: true,
		adjust_race: true
	}
]

const populations = [
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
				key: 'CEU', // term id
				infokey_AC: 'gnomAD_AC_nfe',
				infokey_AN: 'gnomAD_AN_nfe',
				termfilter_value: 'European Ancestry' // comment on usage
			},
			{
				key: 'YRI', // term id
				infokey_AC: 'gnomAD_AC_afr',
				infokey_AN: 'gnomAD_AN_afr',
				termfilter_value: 'African Ancestry'
			},
			{
				key: 'ASA', // term id
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
]

module.exports = {
	isMds3: true,

	/* still only a quick fix
	sample2bam: {
		SJL5088613: 'files/hg38/sjlife/wgs-bam/SJST041646_G1.bam'
	},
	*/

	cohort: {
		allowedChartTypes: ['summary', 'cuminc', 'survival', 'regression'],

		db: {
			file: 'files/hg38/sjlife/clinical/db'
		},

		termdb: {
			allowedTermTypes: [
				'snplst',
				'snplocus' // as independent variable in mass regression
			],

			minTimeSinceDx: 5, // minimum number of years since cancer diagnosis for enrollment in the SJLIFE study

			coxTimeMsg: 'years since entry into the cohort',

			coxStartTimeMsg: `begins at 5 years post cancer diagnosis`,

			// term ids specific to dataset
			termIds: {
				ageDxId: 'agedx', // age at diagnosis
				ageLastVisitId: 'agelastvisit', // age at last visit
				ageNdiId: 'a_ndi', // age at last NDI seach
				ageDeathId: 'a_death' // age at death
			},

			ageEndOffset: 0.00274, // number of years to offset ending age of patients
			// for cox outcome with timeScale='age'
			// 1 day (i.e. 1/365 or 0.00274) needs to be added
			// to age_end to prevent age_end = age_start (which
			// would cause regression analysis to fail in R)

			restrictAncestries,

			selectCohort,
			dataDownloadCatch,

			helpPages: [
				// to use for help button in MASS UI
				// array of url links to help pages
				// if undefined, then help button will not appear
				{
					label: 'Tutorial',
					url: 'https://docs.google.com/document/d/1zofA9oRZMAOHb8WBPKWePMHLgyVeDuHXtadoTf_msRA/edit?usp=sharing'
				},
				{
					label: 'Questions/comments',
					url: 'https://groups.google.com/g/proteinpaint'
				}
			]
		}
	},

	queries: {
		// defaultBlock2GeneMode is not true, to launch block and show locus
		defaultCoord: {
			// default coord for locus view
			chr: 'chr17',
			start: 7670419,
			stop: 7671060
		},

		snvindel: {
			variant_filter,

			// this is placed under snvindel as the data is per-variant allele counts coded as VCF INFO fields
			// the list of population names should be made available to client, no need for details
			populations,

			details: {
				// accessible to client via termdb.js?for=mds3queryDetails

				computeType: 'AF', // for AF of current cohort

				computeType: 'groups',

				groupTestMethod: {
					methods: ['Allele frequency difference', "Fisher's exact test"], // list of available methods to show in <select>
					methodIdx: 1 // methods[] array index for the one in use
				},
				groups: defaultGroups
			},
			byrange: {
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
				}
			}
		}
	}
}
