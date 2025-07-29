import type { CategoricalTerm, NumericTerm } from '#types'

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
		groupsetting: { disabled: true },
		values: {
			1: { label: 'Female', color: 'blue' },
			2: { label: 'Male', color: '#e75480' }
		}
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
	},
	Acountry: {
		id: 'Acountry',
		term: {
			id: 'Acountry',
			type: 'categorical',
			name: 'Country name',
			isleaf: true,
			parentId: 'A',
			order: 1000,
			domainDetails: '',
			values: {
				Kenya: {
					label: 'Kenya',
					color: 'rgb(110, 64, 170)'
				},
				Nigeria: {
					label: 'Nigeria',
					color: 'rgb(140, 62, 178)'
				},
				Ghana: {
					label: 'Ghana',
					color: 'rgb(172, 60, 178)'
				},
				Uganda: {
					label: 'Uganda',
					color: 'rgb(203, 61, 171)'
				},
				Panama: {
					label: 'Panama',
					color: 'rgb(230, 65, 156)'
				},
				Honduras: {
					label: 'Honduras',
					color: 'rgb(251, 73, 135)'
				},
				Mexico: {
					label: 'Mexico',
					color: 'rgb(255, 86, 111)'
				},
				Cameroon: {
					label: 'Cameroon',
					color: 'rgb(255, 103, 88)'
				},
				Ethiopia: {
					label: 'Ethiopia',
					color: 'rgb(255, 124, 67)'
				},
				'South Africa': {
					label: 'South Africa',
					color: 'rgb(252, 148, 52)'
				},
				Tanzania: {
					label: 'Tanzania',
					color: 'rgb(234, 173, 46)'
				},
				Ukraine: {
					label: 'Ukraine',
					color: 'rgb(213, 198, 51)'
				},
				Mongolia: {
					label: 'Mongolia',
					color: 'rgb(192, 221, 66)'
				},
				Armenia: {
					label: 'Armenia',
					color: 'rgb(175, 240, 91)'
				},
				Poland: {
					label: 'Poland',
					color: 'rgb(138, 245, 87)'
				},
				Serbia: {
					label: 'Serbia',
					color: 'rgb(102, 247, 94)'
				},
				Belarus: {
					label: 'Belarus',
					color: 'rgb(70, 245, 110)'
				},
				Tajikistan: {
					label: 'Tajikistan',
					color: 'rgb(46, 238, 133)'
				},
				Kazakhstan: {
					label: 'Kazakhstan',
					color: 'rgb(31, 226, 158)'
				},
				Russia: {
					label: 'Russia',
					color: 'rgb(25, 209, 183)'
				},
				Kyrgyzstan: {
					label: 'Kyrgyzstan',
					color: 'rgb(28, 189, 204)'
				},
				Azerbaijan: {
					label: 'Azerbaijan',
					color: 'rgb(38, 166, 218)'
				},
				Palestine: {
					label: 'Palestine',
					color: 'rgb(52, 142, 225)'
				},
				Brazil: {
					label: 'Brazil',
					color: 'rgb(69, 119, 223)'
				},
				Chile: {
					label: 'Chile',
					color: 'rgb(86, 98, 212)'
				},
				Peru: {
					label: 'Peru',
					color: 'rgb(100, 79, 194)'
				}
			},
			groupsetting: {
				disabled: true
			}
		},
		isAtomic: true,
		q: {
			isAtomic: true,
			mode: 'discrete',
			type: 'values',
			hiddenValues: {}
		},
		type: 'CatTWValues'
	},
	AWHO_region: {
		id: 'AWHO_region',
		term: {
			id: 'AWHO_region',
			type: 'categorical',
			name: 'WHO Region',
			isleaf: true,
			parentId: 'A',
			order: 1000,
			domainDetails: '',
			values: {
				Africa: {
					label: 'Africa',
					color: '#1b9e77'
				},
				Americas: {
					label: 'Americas',
					color: '#d95f02'
				},
				Europe: {
					label: 'Europe',
					color: '#7570b3'
				},
				'Western Pacific': {
					label: 'Western Pacific',
					color: '#e7298a'
				},
				'Eastern Mediterranean': {
					label: 'Eastern Mediterranean',
					color: '#66a61e'
				}
			},
			groupsetting: {
				disabled: true
			}
		},
		isAtomic: true,
		q: {
			isAtomic: true,
			mode: 'discrete',
			type: 'values',
			hiddenValues: {}
		},
		type: 'CatTWValues'
	},
	AIncome_group: {
		id: 'AIncome_group',
		term: {
			id: 'AIncome_group',
			type: 'categorical',
			name: 'World Bank Income Group',
			isleaf: true,
			parentId: 'A',
			order: 1000,
			domainDetails: '',
			values: {
				'Lower middle income': {
					label: 'Lower middle income',
					color: '#1b9e77'
				},
				'Low income': {
					label: 'Low income',
					color: '#d95f02'
				},
				'High income': {
					label: 'High income',
					color: '#7570b3'
				},
				'Upper middle income': {
					label: 'Upper middle income',
					color: '#e7298a'
				}
			},
			groupsetting: {
				disabled: true
			}
		},
		isAtomic: true,
		q: {
			isAtomic: true,
			mode: 'discrete',
			type: 'values',
			hiddenValues: {}
		},
		type: 'CatTWValues'
	},
	AFC_TypeofFacility: {
		id: 'AFC_TypeofFacility',
		term: {
			id: 'AFC_TypeofFacility',
			type: 'categorical',
			name: 'Type of Hospital',
			isleaf: true,
			parentId: 'A',
			order: 1000,
			domainDetails: '',
			values: {
				"Children's Hospital": {
					label: "Children's Hospital",
					color: '#1b9e77'
				},
				'General Hospital': {
					label: 'General Hospital',
					color: '#d95f02'
				},
				'Cancer Hospital or Institute': {
					label: 'Cancer Hospital or Institute',
					color: '#7570b3'
				},
				Other: {
					label: 'Other',
					color: '#e7298a'
				},
				'Pediatric Hematology and/or Oncology Hospital': {
					label: 'Pediatric Hematology and/or Oncology Hospital',
					color: '#66a61e'
				}
			},
			groupsetting: {
				disabled: true
			}
		},
		isAtomic: true,
		q: {
			isAtomic: true,
			mode: 'discrete',
			type: 'values',
			hiddenValues: {}
		},
		type: 'CatTWValues'
	},
	AFC_TeachingFacility: {
		id: 'AFC_TeachingFacility',
		term: {
			id: 'AFC_TeachingFacility',
			type: 'categorical',
			name: 'Government-designated Teaching Facility Status',
			isleaf: true,
			parentId: 'A',
			order: 1000,
			domainDetails: '',
			values: {
				Yes: {
					label: 'Yes',
					color: '#e75480'
				},
				No: {
					label: 'No',
					color: 'blue'
				}
			},
			groupsetting: {
				disabled: true
			}
		},
		isAtomic: true,
		q: {
			isAtomic: true,
			mode: 'discrete',
			type: 'values',
			hiddenValues: {}
		},
		type: 'CatTWValues'
	}
}
