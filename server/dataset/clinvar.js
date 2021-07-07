module.exports.clinsig = {
	Uncertain_significance: { color: '#aaa', label: 'Uncertain significance', textcolor: 'white' },
	not_provided: { color: '#ccc', label: 'Not provided' },
	_not_provided: { color: '#ccc', label: 'Not provided' },
	Benign: { color: '#43ac6a', label: 'Benign', textcolor: 'white' },
	'Benign/Likely_benign': { color: '#43ac6a', label: 'Benign/Likely benign', textcolor: 'white' },
	Likely_benign: { color: '#5bc0de', label: 'Likely benign', textcolor: 'white' },
	Likely_pathogenic: { color: '#e99002', label: 'Likely pathogenic', textcolor: 'white' },
	Pathogenic: { color: '#f04124', label: 'Pathogenic', textcolor: 'white' },
	'Pathogenic/Likely_pathogenic': { color: '#f04124', label: 'Pathogenic/Likely pathogenic', textcolor: 'white' },
	drug_response: { color: 'gold', label: 'Drug response', textcolor: 'white' },
	_drug_response: { color: 'gold', label: 'Drug response', textcolor: 'white' },
	Conflicting_interpretations_of_pathogenicity: {
		color: '#90C3D4',
		label: 'Conflicting interpretations of pathogenicity'
	},
	other: { color: '#ccc', label: 'Other' },
	_other: { color: '#ccc', label: 'Other' },
	not_provided: { color: '#ccc', label: 'Not provided' },
	_not_provided: { color: '#ccc', label: 'Not provided' },
	risk_factor: { color: '#ccc', label: 'Risk factor' },
	_risk_factor: { color: '#ccc', label: 'Risk factor' },
	association: { color: '#ccc', label: 'Association' },
	_association: { color: '#ccc', label: 'Association' },
	Affects: { color: '#ccc', label: 'Affects' },
	_Affects: { color: '#ccc', label: 'Affects' },
	protective: { color: '#ccc', label: 'Protective' },
	_protective: { color: '#ccc', label: 'Protective' }
}

module.exports.AF = {
	AF_EXAC: {
		name: 'ExAC frequency',
		locusinfo: { key: 'AF_EXAC' },
		numericfilter: [{ side: '<', value: 0.0001 }, { side: '<', value: 0.001 }, { side: '<', value: 0.01 }]
	},
	AF_ESP: {
		name: 'GO-ESP frequency',
		locusinfo: { key: 'AF_ESP' },
		numericfilter: [{ side: '<', value: 0.0001 }, { side: '<', value: 0.001 }, { side: '<', value: 0.01 }]
	},
	AF_TGP: {
		name: '1000 Genomes frequency',
		locusinfo: { key: 'AF_TGP' },
		numericfilter: [{ side: '<', value: 0.0001 }, { side: '<', value: 0.001 }, { side: '<', value: 0.01 }]
	}
}
