import tape from 'tape'
import { getCategoricalTermFilter } from '../filter.js'

const filterTWs = [
	{
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
	{
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
	{
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
	{
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
	{
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
]

tape('getCategoricalTermFilter returns correct filter object', t => {
	const countryTW = filterTWs.find(tw => tw.term.id === 'Acountry')
	const valuesCountry = { Acountry: 'Kenya' }
	const emptyFilter = { type: 'tvslst', in: true, join: '', lst: [] }
	const result1 = getCategoricalTermFilter(filterTWs, valuesCountry, countryTW)
	t.deepEqual(
		result1,
		emptyFilter,
		'Should filter out samples according to all the filter values except for the tw provided, as only one filter is provided and is for the tw passed there is no filter added'
	)

	const result2 = getCategoricalTermFilter(filterTWs, valuesCountry, null)
	const countryFilter = {
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: countryTW!.term,
					values: [
						{
							key: 'Kenya'
						}
					]
				}
			}
		]
	}
	t.deepEqual(
		result2,
		countryFilter,
		'If there is no tw provided build filter with all the terms specified in the values'
	)

	const valuesCountryType = { Acountry: 'Kenya', AFC_TypeofFacility: 'Cancer Hospital or Institute' }
	const facilityTypeTW = filterTWs.find(tw => tw.term.id === 'AFC_TypeofFacility')
	const result3 = getCategoricalTermFilter(filterTWs, valuesCountryType, facilityTypeTW)
	t.deepEqual(
		result3,
		countryFilter,
		`Create filter with the other values provided, therefore filter only by the country value specified.
         This allows to find the facilities for Kenya and build the dropdown with all the facility types found.`
	)
	console.log(result3, countryFilter)
	const countrySiteFilter = {
		type: 'tvslst',
		in: true,
		join: 'and',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: countryTW!.term,
					values: [
						{
							key: 'Kenya'
						}
					]
				}
			},
			{
				type: 'tvs',
				tvs: {
					term: facilityTypeTW!.term,
					values: [
						{
							key: 'Cancer Hospital or Institute'
						}
					]
				}
			}
		]
	}
	const result4 = getCategoricalTermFilter(filterTWs, valuesCountryType, null)
	t.deepEqual(
		result4,
		countrySiteFilter,
		`We want to build the filter with all the filter values provided, as there are values for both country and facility type the filter should include both.
         terms and values should be the ones specified in the values object.`
	)

	t.end()
})
