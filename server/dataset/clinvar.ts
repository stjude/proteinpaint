import type { InfoFieldCategories, ClinvarAF } from '#types'

export const clinsig: InfoFieldCategories = {
	Affects: {
		color: '#ccc',
		label: 'Affects',
		desc: 'Variants that cause a non-disease phenotype, such as lactose intolerance.'
	},
	Benign: { color: '#43ac6a', label: 'Benign', textcolor: 'white', desc: 'The variant is reported to be benign.' },
	'Benign/Likely_benign': {
		color: '#43ac6a',
		label: 'Benign/Likely benign',
		textcolor: 'white',
		desc: 'The variant is reported to be benign/likely benign by different submitters.'
	},
	Likely_benign: {
		color: '#5bc0de',
		label: 'Likely benign',
		textcolor: 'white',
		desc: 'The variant is reported to be likely benign.'
	},

	Conflicting_interpretations_of_pathogenicity: {
		color: '#90C3D4',
		label: 'Conflicting interpretations of pathogenicity',
		desc: 'The variant has conflicting clinical assertions from different submitters.'
	},

	Likely_pathogenic: {
		color: '#e99002',
		label: 'Likely pathogenic',
		textcolor: 'white',
		desc: 'The variant is reported to be likely pathogenic.'
	},
	'Likely_pathogenic,_low_penetrance': {
		color: '#e99002',
		label: 'Likely pathogenic/Low penetrance',
		desc: 'The variant is reported to be likely pathogenic with low penetrance.'
	},
	'Likely_pathogenic/Likely_risk_allele': {
		color: '#e99002',
		label: 'Likely pathogenic/Likely risk allele',
		desc: 'The variant is reported to be likely pathogenic/likely risk allele by different submitters.'
	},
	Likely_risk_allele: { color: '#e99002', label: 'Likely risk allele', desc: '' },

	Pathogenic: {
		color: '#f04124',
		label: 'Pathogenic',
		textcolor: 'white',
		desc: 'The variant is reported to be pathogenic.'
	},
	'Likely_pathogenic/Pathogenic,_low_penetrance': {
		color: '#f04124',
		label: 'Likely pathogenic/Pathogenic/Low penetrance',
		desc: 'The variant is reported likely pathogenic/pathogenic with low penetrance by different submitters.'
	},
	'Pathogenic/Likely_pathogenic/Pathogenic,_low_penetrance': {
		color: '#f04124',
		label: 'Pathogenic/Likely pathogenic/Low penetrance',
		desc: 'The variant is reported likely pathogenic/pathogenic with low penetrance by different submitters.'
	},
	'Pathogenic/Likely_pathogenic': {
		color: '#f04124',
		label: 'Pathogenic/Likely pathogenic',
		textcolor: 'white',
		desc: 'The variant is reported to be pathogenic/likely pathogenic by different submitters.'
	},
	'Pathogenic/Likely_pathogenic/Likely_risk_allele': {
		color: '#f04124',
		label: 'Pathogenic/Likely pathogenic/Likely risk allele',
		desc: 'The variant is reported to be pathogenic, likely pathogenic or likely risk allele by different submitters.'
	},
	'Pathogenic/Likely_risk_allele': {
		color: '#f04124',
		label: 'Pathogenic/Likely risk allele',
		desc: 'The variant is reported pathogenic/likely risk allele by different submitters.'
	},
	'Pathogenic/Pathogenic,_low_penetrance': {
		color: '#f04124',
		label: 'Pathogenic/Low penetrance',
		desc: 'The variant is reported pathogenic with low penetrance.'
	},

	Uncertain_risk_allele: {
		color: '#aaa',
		label: 'Uncertain risk allele',
		textcolor: 'white',
		desc: 'A genetic change affecting an allele whose impact on the individual’s disease risk is not yet known.'
	},
	Uncertain_significance: {
		color: '#aaa',
		label: 'Uncertain significance',
		textcolor: 'white',
		desc: 'A genetic change whose impact on the individual’s disease risk is not yet known.'
	},
	'Uncertain_significance/Uncertain_risk_allele': {
		color: '#aaa',
		label: 'Uncertain significance/Uncertain risk allele',
		desc: 'The variant is reported of uncertain significance/uncertain risk allele by different submitters.'
	},

	association: {
		color: '#ccc',
		label: 'Association',
		desc: 'Variants identified in a GWAS study and further interpreted for their clinical significance.'
	},
	association_not_found: {
		color: '#ccc',
		label: 'Association not found',
		desc: 'No significant GWAS association study found.'
	},
	confers_sensitivity: { color: '#ccc', label: 'Confers sensitivity', desc: '' },
	drug_response: {
		color: 'gold',
		label: 'Drug response',
		textcolor: 'white',
		desc: 'The variant is reported to affect a drug response.'
	},
	not_provided: {
		color: '#ccc',
		label: 'Not provided',
		desc: 'Clinical significance for the variant has not been provided by the submitter.'
	},
	other: {
		color: '#ccc',
		label: 'Other',
		desc: 'The variant has some other clinical significance, such as protective, association, confers sensitivity.'
	},
	protective: {
		color: '#ccc',
		label: 'Protective',
		desc: 'Variants that decrease the risk of a disorder, including infections.'
	},
	risk_factor: {
		color: '#ccc',
		label: 'Risk factor',
		desc: 'The variant is reported to be a risk factor for a particular disease.'
	}
}

export const AF: ClinvarAF = {
	AF_EXAC: {
		name: 'ExAC frequency',
		locusinfo: { key: 'AF_EXAC' },
		numericfilter: [
			{ side: '<', value: 0.0001 },
			{ side: '<', value: 0.001 },
			{ side: '<', value: 0.01 }
		]
	},
	AF_ESP: {
		name: 'GO-ESP frequency',
		locusinfo: { key: 'AF_ESP' },
		numericfilter: [
			{ side: '<', value: 0.0001 },
			{ side: '<', value: 0.001 },
			{ side: '<', value: 0.01 }
		]
	},
	AF_TGP: {
		name: '1000 Genomes frequency',
		locusinfo: { key: 'AF_TGP' },
		numericfilter: [
			{ side: '<', value: 0.0001 },
			{ side: '<', value: 0.001 },
			{ side: '<', value: 0.01 }
		]
	}
}
