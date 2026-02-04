import tape from 'tape'
import { filter2GDCfilter } from '../mds3.gdc.filter.js'

tape('\n', function (test) {
	test.comment('-***- mds3.gdc.filter specs -***-')
	test.end()
})

tape('various filter situations', async function (test) {
	{
		const f = filter2GDCfilter({ type: 'tvslst', in: true, join: '', lst: [] })
		test.equal(f, null, 'blank filter should return null')
	}

	{
		const f = filter2GDCfilter(filterCategorical.ppfilter)
		test.deepEqual(f, filterCategorical.gdcfilter, 'categorical filter should be transformed')
	}

	{
		const f = filter2GDCfilter(filterNum.ppfilter)
		test.deepEqual(f, filterNum.gdcfilter, 'numerical filter should be transformed')
	}

	{
		// modify existing pp filter by inserting a mock dtTerm-based tvs, this should be ignored in converting to gdc filter
		filterNum.ppfilter.lst.push({
			type: 'tvs',
			tvs: {
				term: { type: 'dtsnvindel' }
			}
		})
		const f = filter2GDCfilter(filterNum.ppfilter)
		test.deepEqual(f, filterNum.gdcfilter, 'dtTerm tvs is ignored')
	}

	{
		// modify existing pp filter by inserting a gene exp tvs, this should be ignored in converting to gdc filter
		filterNum.ppfilter.lst.push({
			type: 'tvs',
			tvs: {
				term: { type: 'geneExpression' }
			}
		})
		const f = filter2GDCfilter(filterNum.ppfilter)
		test.deepEqual(f, filterNum.gdcfilter, 'geneExpression tvs is ignored')
	}

	test.end()
})

tape('nested filter', async function (test) {
	const f = {
		type: 'tvslst',
		in: true,
		join: 'and',
		lst: [
			{
				type: 'tvslst',
				join: 'or',
				lst: [
					{
						type: 'tvs',
						tvs: {
							term: {
								id: 'case.demographic.cause_of_death',
								name: 'Cause of death',
								groupsetting: {
									disabled: false
								},
								isleaf: true,
								type: 'categorical',
								parent_id: 'case.demographic',
								included_types: ['categorical'],
								child_types: [],
								cohort: '',
								__ancestors: ['case.demographic', 'case.demographic.cause_of_death'],
								__ancestorNames: ['case.demographic', 'case.demographic.cause_of_death']
							},
							values: [
								{
									samplecount: 155,
									key: 'Cancer Related',
									label: 'Cancer Related',
									bar_width_frac: 1
								}
							]
						}
					},
					{
						type: 'tvs',
						tvs: {
							term: {
								id: 'case.diagnoses.age_at_diagnosis',
								name: 'Age at diagnosis',
								groupsetting: {
									disabled: false
								},
								isleaf: true,
								type: 'integer',
								valueConversion: {
									scaleFactor: 0.0027378507871321013,
									fromUnit: 'day',
									toUnit: 'year'
								},
								parent_id: 'case.diagnoses',
								bins: {
									default: {
										type: 'custom-bin',
										mode: 'discrete',
										lst: [
											{
												startunbounded: true,
												stop: 10950,
												stopinclusive: true,
												label: '<=30 years'
											},
											{
												start: 10950,
												stop: 21900,
												stopinclusive: true,
												label: '30-60 years'
											},
											{
												start: 21900,
												stopunbounded: true,
												startinclusive: false,
												label: '>60years'
											}
										]
									}
								},
								included_types: ['integer'],
								child_types: [],
								cohort: ''
							},
							ranges: [
								{
									start: 10157,
									stop: 16729,
									startinclusive: false,
									stopinclusive: false,
									startunbounded: false,
									stopunbounded: false
								}
							]
						}
					}
				],
				in: true
			},
			{
				type: 'tvs',
				tvs: {
					term: {
						id: 'case.demographic.year_of_birth',
						name: 'Year of birth',
						groupsetting: {
							disabled: false
						},
						isleaf: true,
						type: 'integer',
						parent_id: 'case.demographic',
						bins: {
							default: {
								mode: 'discrete',
								type: 'regular-bin',
								bin_size: 20,
								startinclusive: false,
								stopinclusive: true,
								first_bin: {
									startunbounded: true,
									stop: 1938
								}
							}
						},
						included_types: ['integer'],
						child_types: [],
						cohort: ''
					},
					ranges: [
						{
							start: 1967,
							stop: 1971,
							startinclusive: false,
							stopinclusive: false,
							startunbounded: false,
							stopunbounded: false
						}
					]
				}
			}
		]
	}

	const expected = {
		op: 'and',
		content: [
			{
				op: 'or',
				content: [
					{
						op: 'in',
						content: {
							field: 'cases.demographic.cause_of_death',
							value: ['Cancer Related']
						}
					},
					{
						op: 'or',
						content: [
							{
								op: 'and',
								content: [
									{
										op: '>',
										content: {
											field: 'cases.diagnoses.age_at_diagnosis',
											value: 10157
										}
									},
									{
										op: '<',
										content: {
											field: 'cases.diagnoses.age_at_diagnosis',
											value: 16729
										}
									}
								]
							}
						]
					}
				]
			},
			{
				op: 'or',
				content: [
					{
						op: 'and',
						content: [
							{
								op: '>',
								content: {
									field: 'cases.demographic.year_of_birth',
									value: 1967
								}
							},
							{
								op: '<',
								content: {
									field: 'cases.demographic.year_of_birth',
									value: 1971
								}
							}
						]
					}
				]
			}
		]
	}

	console.log(JSON.stringify(expected, null, '  '))
	test.deepEqual(filter2GDCfilter(f), expected, 'dtTerm tvs is ignored')
	test.end()
})

///////// constants
const filterCategorical = {
	ppfilter: {
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: {
						id: 'case.demographic.gender',
						name: 'Gender',
						isleaf: true,
						type: 'categorical',
						parent_id: 'case.demographic',
						included_types: ['categorical'],
						child_types: [],
						values: {},
						samplecount: {}
					},
					values: [{ key: 'female' }],
					isnot: true
				}
			}
		]
	},
	gdcfilter: { op: 'and', content: [{ op: '!=', content: { field: 'cases.demographic.gender', value: ['female'] } }] }
}
const filterNum = {
	ppfilter: {
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: {
						id: 'case.diagnoses.age_at_diagnosis',
						name: 'Age at diagnosis',
						isleaf: true,
						type: 'integer',
						valueConversion: {
							scaleFactor: 0.0027397260273972603,
							fromUnit: 'day',
							toUnit: 'year'
						},
						parent_id: 'case.diagnoses',
						bins: {
							default: {
								type: 'custom-bin',
								mode: 'discrete',
								lst: [
									{
										startunbounded: true,
										stop: 10950,
										stopinclusive: true,
										label: '<=30 years'
									},
									{
										start: 10950,
										stop: 21900,
										stopinclusive: true,
										label: '30-60 years'
									},
									{
										start: 21900,
										stopunbounded: true,
										startinclusive: false,
										label: '>60years'
									}
								]
							}
						},
						included_types: ['integer'],
						child_types: []
					},
					ranges: [
						{
							start: 10000,
							stop: 20000,
							startinclusive: false,
							stopinclusive: true
						},
						// this filter will exclude a range of values between 2000 and 70000
						{
							start: 50000,
							stop: 70000,
							startinclusive: false,
							stopinclusive: true
						}
					],
					isnot: true
				}
			}
		]
	},
	gdcfilter: {
		op: 'and',
		content: [
			{
				op: 'not',
				content: {
					op: 'or',
					content: [
						{
							op: 'and',
							content: [
								{ op: '>', content: { field: 'cases.diagnoses.age_at_diagnosis', value: 10000 } },
								{ op: '<=', content: { field: 'cases.diagnoses.age_at_diagnosis', value: 20000 } }
							]
						},
						{
							op: 'and',
							content: [
								{ op: '>', content: { field: 'cases.diagnoses.age_at_diagnosis', value: 50000 } },
								{ op: '<=', content: { field: 'cases.diagnoses.age_at_diagnosis', value: 70000 } }
							]
						}
					]
				}
			}
		]
	}
}

// TODO when fixed, test nested filter here
