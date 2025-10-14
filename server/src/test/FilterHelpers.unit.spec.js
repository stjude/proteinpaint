import tape from 'tape'
import FilterHelpers from '../adHocDictionary/FilterHelpers.js'

const mockImageKeyIdx = 0
const mockHeadersMap = new Map([
	['sampleId', { idx: 0, label: 'Sample ID' }],
	['age', { idx: 1, label: 'Age' }],
	['dx', { idx: 2, label: 'Diagnosis' }]
])
const mockDataRows = [
	'sampleId,age,dx',
	'S1,45,Healthy',
	'S2,60,Cancer',
	'S3,30,Healthy',
	'S4,50,Diabetes',
	'S5,25,Healthy'
]

new FilterHelpers(mockImageKeyIdx, mockHeadersMap)

/**************
 test sections
***************/

tape('\n', async function (test) {
	test.comment('-***- src/adHocDictionary/FilterHelpers -***-')
	test.end()
})

tape('FilterHelpers constructor', async function (test) {
	test.timeoutAfter(300)

	test.equal(typeof FilterHelpers.normalizeFilter, 'function', 'Should have .normalizedFilter() method')
	test.equal(typeof FilterHelpers.getMatches, 'function', 'Should have .getMatches() method')
	test.equal(typeof FilterHelpers.formatData, 'function', 'Should have .formatData() method')

	test.end()
})

tape('Empty filter given to FilterHelpers.normalizeFilter() returns null', async function (test) {
	test.timeoutAfter(300)

	const mockFilter = {}
	const expected = null
	const result = FilterHelpers.normalizeFilter(mockFilter)
	test.equal(result, expected, 'Should return null for empty filter object')

	test.end()
})

tape('Null given to FilterHelpers.normalizeFilter() returns null', async function (test) {
	test.timeoutAfter(300)

	const mockFilter = null
	const expected = null
	const result = FilterHelpers.normalizeFilter(mockFilter)
	test.equal(result, expected, 'Should return null for null input')

	test.end()
})

tape('Simple tvslst given to FilterHelpers.normalizeFilter() returns normalized obj', async function (test) {
	test.timeoutAfter(300)

	const mockFilter = {
		type: 'tvslst',
		join: '',
		in: true,
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { id: 'age', type: 'integer' },
					ranges: [{ start: 25, stop: 35, startinclusive: true, stopinclusive: false }]
				}
			}
		]
	}
	const expected = {
		type: 'tvslst',
		join: '',
		in: true,
		lst: [
			{
				termid: 'age',
				type: 'integer',
				filter: [{ min: 25, max: 35, includeMin: true, includeMax: false }],
				isNot: false
			}
		]
	}
	const result = FilterHelpers.normalizeFilter(mockFilter)
	test.deepEqual(result, expected, 'Should normalize filter object for a tvslst with range filter')

	test.end()
})

tape('Categorical tvs given to FilterHelpers.normalizeFilter() returns normalized obj', async function (test) {
	test.timeoutAfter(300)

	const mockFilter = {
		type: 'tvs',
		tvs: {
			term: { id: 'dx', type: 'categorical' },
			values: [{ key: 'cancer', label: 'Cancer' }]
		}
	}
	const expected = {
		termid: 'dx',
		type: 'categorical',
		filter: ['cancer'],
		isNot: false
	}
	const result = FilterHelpers.normalizeFilter(mockFilter)
	test.deepEqual(result, expected, 'Should normalize filter object for a categorical tvs term')

	test.end()
})

tape('Nested tvslst given to FilterHelpers.normalizeFilter() returns normalized obj', async function (test) {
	test.timeoutAfter(300)

	const mockFilter = {
		type: 'tvslst',
		join: 'and',
		in: true,
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { id: 'age', type: 'integer' },
					ranges: [{ start: 25, stop: 35, startinclusive: true, stopinclusive: false }]
				}
			},
			{
				type: 'tvs',
				tvs: {
					term: { id: 'dx', type: 'categorical' },
					values: [{ key: 'cancer', label: 'Cancer' }]
				}
			}
		]
	}
	const expected = {
		type: 'tvslst',
		join: 'and',
		in: true,
		lst: [
			{
				termid: 'age',
				type: 'integer',
				filter: [{ min: 25, max: 35, includeMin: true, includeMax: false }],
				isNot: false
			},
			{ termid: 'dx', type: 'categorical', filter: ['cancer'], isNot: false }
		]
	}
	const result = FilterHelpers.normalizeFilter(mockFilter)
	test.deepEqual(result, expected, 'Should normalize filter object for a nested tvslst')

	test.end()
})

tape('Simple categorical filter returns matches in FilterHelpers.getMatches() ', async function (test) {
	test.timeoutAfter(300)

	const mockFilter = {
		type: 'tvslst',
		join: '',
		in: true,
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { id: 'dx', type: 'categorical' },
					values: [{ key: 'Cancer', label: 'Cancer' }]
				}
			}
		]
	}
	const normalized = FilterHelpers.normalizeFilter(mockFilter)
	const result = FilterHelpers.getMatches(normalized, mockDataRows)
	const expected = [['S2', '60', 'Cancer']]
	test.deepEqual(result, expected, 'Should return array of matching data rows for categorical filter')

	test.end()
})

tape('Nested filter returns multiple matches in FilterHelpers.getMatches() ', async function (test) {
	test.timeoutAfter(300)

	const mockFilter = {
		type: 'tvslst',
		join: 'and',
		in: true,
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { id: 'age', type: 'integer' },
					ranges: [{ start: 25, stop: 35, startinclusive: true, stopinclusive: false }]
				}
			},
			{
				type: 'tvs',
				tvs: {
					term: { id: 'dx', type: 'categorical' },
					values: [{ key: 'Healthy', label: 'Healthy' }]
				}
			}
		]
	}
	const normalized = FilterHelpers.normalizeFilter(mockFilter)
	const result = FilterHelpers.getMatches(normalized, mockDataRows)
	const expected = [
		['S3', '30', 'Healthy'],
		['S5', '25', 'Healthy']
	]
	test.deepEqual(result, expected, 'Should return array of matching data rows for nested filter.')

	test.end()
})

tape('No matches found in FilterHelpers.getMatches() ', async function (test) {
	test.timeoutAfter(300)

	//No matches
	const mockFilter = {
		type: 'tvslst',
		join: 'and',
		in: true,
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { id: 'age', type: 'integer' },
					ranges: [{ start: 25, stop: 35, startinclusive: true, stopinclusive: false }]
				}
			},
			{
				type: 'tvs',
				tvs: {
					term: { id: 'dx', type: 'categorical' },
					values: [{ key: 'Cancer', label: 'Cancer' }]
				}
			}
		]
	}
	const normalized = FilterHelpers.normalizeFilter(mockFilter)
	const result = FilterHelpers.getMatches(normalized, mockDataRows)
	const expected = []
	test.deepEqual(result, expected, 'Should return empty array when there are no matches.')

	test.end()
})

tape('Invalid term id returns empty array from FilterHelpers.getMatches()', async function (test) {
	test.timeoutAfter(300)

	//Invalid term id
	const mockFilter = {
		type: 'tvslst',
		join: 'and',
		in: true,
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { id: 'age', type: 'integer' },
					ranges: [{ start: 25, stop: 35, startinclusive: true, stopinclusive: false }]
				}
			},
			{
				type: 'tvs',
				tvs: {
					term: { id: 'invalid', type: 'categorical' },
					values: [{ key: 'test', label: 'test' }]
				}
			}
		]
	}
	const normalized = FilterHelpers.normalizeFilter(mockFilter)
	const result = FilterHelpers.getMatches(normalized, mockDataRows)
	const expected = []
	test.deepEqual(result, expected, 'Should return empty array for invalid terms.')

	test.end()
})

tape('FilterHelpers.formatData()', async function (test) {
	test.timeoutAfter(300)

	const matchRows = [
		['S2', '60', 'Cancer'],
		['S3', '30', 'Healthy'],
		['S5', '25', 'Healthy']
	]
	const expected = {
		cols: [{ label: 'Sample ID' }, { label: 'Age' }, { label: 'Diagnosis' }],
		rows: [
			[{ value: 'S2' }, { value: '60' }, { value: 'Cancer' }],
			[{ value: 'S3' }, { value: '30' }, { value: 'Healthy' }],
			[{ value: 'S5' }, { value: '25' }, { value: 'Healthy' }]
		],
		images: ['S2', 'S3', 'S5']
	}

	const result = FilterHelpers.formatData(matchRows)
	test.deepEqual(result, expected, 'Should return formatted data for rendering.')

	test.end()
})
