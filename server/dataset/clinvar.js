module.exports.clinsig = {
	Uncertain_significance: { color: '#aaa', label: 'Uncertain significance', textcolor: 'white', desc: "A genetic change whose impact on the individual’s cancer risk is not yet known."},
	not_provided: { color: '#ccc', label: 'Not provided' , desc: "Clinical significance for the variant has not been provided by the submitter."},
	_not_provided: { color: '#ccc', label: 'Not provided', desc: "Clinical significance for the variant has not been provided by the submitter." },
	Benign: { color: '#43ac6a', label: 'Benign', textcolor: 'white', desc : "The variant is reported to be benign." },
	'Benign/Likely_benign': { color: '#43ac6a', label: 'Benign/Likely benign', textcolor: 'white' , desc: "The variant is reported to be benign/likely benign by different submitters."},
	Likely_benign: { color: '#5bc0de', label: 'Likely benign', textcolor: 'white' , desc: "The variant is reported to be likely benign."},
	Likely_pathogenic: { color: '#e99002', label: 'Likely pathogenic', textcolor: 'white' , desc: "The variant is reported to be likely pathogenic."},
	Pathogenic: { color: '#f04124', label: 'Pathogenic', textcolor: 'white' , desc: "The variant is reported to be pathogenic."},
	'Pathogenic/Likely_pathogenic': { color: '#f04124', label: 'Pathogenic/Likely pathogenic', textcolor: 'white' , desc: "The variant is reported to be pathogenic/likely pathogenic by different submitters."},
	drug_response: { color: 'gold', label: 'Drug response', textcolor: 'white' , desc: "The variant is reported to affect a drug response."},
	_drug_response: { color: 'gold', label: 'Drug response', textcolor: 'white', desc: "The variant is reported to affect a drug response." },
	Conflicting_interpretations_of_pathogenicity: {
		color: '#90C3D4',
		label: 'Conflicting interpretations of pathogenicity',
		desc: "The variant has conflicting clinical assertions from different submitters."
	},
	other: { color: '#ccc', label: 'Other', desc: "The variant has some other clinical significance, such as protective, association, confers sensitivity." },
	_other: { color: '#ccc', label: 'Other' , desc: "The variant has some other clinical significance, such as protective, association, confers sensitivity."},
	not_provided: { color: '#ccc', label: 'Not provided', desc: "Clinical significance for the variant has not been provided by the submitter."},
	_not_provided: { color: '#ccc', label: 'Not provided', desc: "Clinical significance for the variant has not been provided by the submitter." },
	risk_factor: { color: '#ccc', label: 'Risk factor', desc: "The variant is reported to be a risk factor for a particular disease."},
	_risk_factor: { color: '#ccc', label: 'Risk factor', desc: "The variant is reported to be a risk factor for a particular disease." },
	association: { color: '#ccc', label: 'Association', desc: "Variants identified in a GWAS study and further interpreted for their clinical significance." },
	_association: { color: '#ccc', label: 'Association', desc: "Variants identified in a GWAS study and further interpreted for their clinical significance." },
	Affects: { color: '#ccc', label: 'Affects', desc: "Variants that cause a non-disease phenotype, such as lactose intolerance." },
	_Affects: { color: '#ccc', label: 'Affects' , desc: "Variants that cause a non-disease phenotype, such as lactose intolerance."},
	protective: { color: '#ccc', label: 'Protective', desc: "Variants that decrease the risk of a disorder, including infections." },
	_protective: { color: '#ccc', label: 'Protective', desc: "Variants that decrease the risk of a disorder, including infections." }
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
