import { CategoricalTerm, NumericTerm } from '#types'

const diaggrp: CategoricalTerm = {
	id: 'diaggrp',
	name: 'Diagnosis Group',
	type: 'categorical' as const,
	isleaf: true,
	values: {
		'Acute lymphoblastic leukemia': { label: 'Acute lymphoblastic leukemia' },
		'Acute myeloid leukemia': { label: 'Acute myeloid leukemia' },
		'Blood disorder': { label: 'Blood disorder' },
		'Central nervous system (CNS)': { label: 'Central nervous system (CNS)' },
		'Chronic myeloid leukemia': { label: 'Chronic myeloid leukemia' },
		'Colon carcinoma': { label: 'Colon carcinoma' },
		'Ewing sarcoma family of tumors': { label: 'Ewing sarcoma family of tumors' },
		'Germ cell tumor': { label: 'Germ cell tumor' },
		Histiocytosis: { label: 'Histiocytosis' },
		'Hodgkin lymphoma': { label: 'Hodgkin lymphoma' },
		'Liver malignancies': { label: 'Liver malignancies' },
		'MDS/Acute myeloid leukemia': { label: 'MDS/Acute myeloid leukemia' },
		Melanoma: { label: 'Melanoma' },
		'Myelodysplastic syndrome': { label: 'Myelodysplastic syndrome' },
		'Nasopharyngeal carcinoma': { label: 'Nasopharyngeal carcinoma' },
		Nephroblastomatosis: { label: 'Nephroblastomatosis' },
		Neuroblastoma: { label: 'Neuroblastoma' },
		'Non-Hodgkin lymphoma': { label: 'Non-Hodgkin lymphoma' },
		'Non-malignancy': { label: 'Non-malignancy' },
		Osteosarcoma: { label: 'Osteosarcoma' },
		'Other carcinoma': { label: 'Other carcinoma' },
		'Other leukemia': { label: 'Other leukemia' },
		'Other malignancy': { label: 'Other malignancy' },
		Retinoblastoma: { label: 'Retinoblastoma' },
		Rhabdomyosarcoma: { label: 'Rhabdomyosarcoma' },
		'Soft tissue sarcoma': { label: 'Soft tissue sarcoma' },
		'Wilms tumor': { label: 'Wilms tumor' }
	},
	groupsetting: { disabled: false }
}

const agedx: NumericTerm = {
	id: 'agedx',
	name: 'Age at Cancer Diagnosis',
	unit: 'Years',
	type: 'float' as const,
	bins: {
		label_offset: 1,
		default: {
			type: 'regular-bin',
			label_offset: 1,
			bin_size: 3,
			//startinclusive: true,
			first_bin: {
				startunbounded: true,
				stop: 2
			}
		},
		less: {
			type: 'regular-bin',
			label_offset: 1,
			bin_size: 5,
			//startinclusive: true,
			first_bin: {
				startunbounded: true,
				stop: 5
			},
			last_bin: {
				stopunbounded: true,
				start: 15
			}
		}
	},
	isleaf: true
}

export const termjson = {
	diaggrp,
	agedx,
	os: {
		id: 'os',
		name: 'Overall survival',
		type: 'survival',
		unit: 'years',
		isleaf: true
	},
	Arrhythmias: {
		id: 'Arrhythmias',
		name: 'Arrhythmias',
		type: 'condition' as const,
		values: {
			0: { label: '0: No condition' },
			1: { label: '1: Mild' },
			2: { label: '2: Moderate' },
			3: { label: '3: Severe' },
			4: { label: '4: Life-threatening' },
			5: { label: '5: Death' },
			9: { label: 'Unknown status', uncomputable: true }
		}
	},
	aaclassic_5: {
		id: 'aaclassic_5',
		name: 'Cumulative Alkylating Agent (Cyclophosphamide Equivalent Dose)',
		unit: 'mg/m²',
		type: 'float' as const,
		bins: {
			label_offset: 1,
			default: {
				type: 'regular-bin',
				bin_size: 1000,
				startinclusive: true,
				first_bin: {
					startunbounded: true,
					stop: 2000
				},
				last_bin: {
					stopunbounded: true,
					start: 16000
				}
			}
		},
		values: {
			'-1': { label: 'not exposed', uncomputable: true },
			'-8888': { label: 'Exposed but dose unknown', uncomputable: true },
			'-9999': { label: 'Unknown treatment record', uncomputable: true }
		},
		isleaf: true
	},
	sex: {
		id: 'sex',
		name: 'Sex',
		type: 'categorical' as const,
		groupsetting: { disabled: true }
	},
	idarubicin_5: {
		id: 'idarubicin_5',
		name: 'Idarubicin (IV)',
		unit: 'mg/m²',
		type: 'float',
		bins: {
			default: {
				type: 'regular-bin',
				bin_size: 10,
				stopinclusive: true,
				first_bin: {
					startunbounded: true,
					stop: 10,
					stopinclusive: true
				},
				last_bin: {
					stopunbounded: true,
					start: 40
				}
			}
		},
		values: {
			0: { label: 'Not exposed', uncomputable: true },
			'-8888': { label: 'Exposed but dose unknown', uncomputable: true },
			'-9999': { label: 'Unknown treatment record', uncomputable: true }
		}
	},
	hrtavg: {
		type: 'float' as const,
		bins: {
			default: {
				type: 'regular-bin',
				startinclusive: true,
				bin_size: 500,
				first_bin: { stop: 500 },
				last_bin: { start: 3500 }
			}
		},
		values: {
			'-8888': { label: 'exposed, dose unknown', uncomputable: true },
			'-9999': { label: 'unknown exposure', uncomputable: true }
		},
		name: 'Average dose to heart + TBI, cGy',
		skip0forPercentile: true,
		id: 'hrtavg',
		isleaf: true
	},
	'Cardiac dysrhythmia': {
		id: 'Cardiac dysrhythmia',
		name: 'Cardiac dysrhythmia',
		parent_id: 'Arrhythmias',
		type: 'condition',
		values: {
			0: { label: '0: No condition' },
			1: { label: '1: Mild' },
			2: { label: '2: Moderate' },
			3: { label: '3: Severe' },
			4: { label: '4: Life-threatening' },
			5: { label: '5: Death' },
			9: { label: 'Unknown status', uncomputable: true }
		}
	}
}
