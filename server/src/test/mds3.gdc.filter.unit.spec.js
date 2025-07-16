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
				op: 'or',
				content: [
					{ op: 'and', content: [{ op: '<=', content: { field: 'cases.diagnoses.age_at_diagnosis', value: 10000 } }] },
					{ op: 'and', content: [{ op: '>', content: { field: 'cases.diagnoses.age_at_diagnosis', value: 20000 } }] }
				]
			}
		]
	}
}

// TODO when fixed, test nested filter here
