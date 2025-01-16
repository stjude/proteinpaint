import tape from 'tape'
import { termjson } from '../../test/testdata/termjson.js'
import { parseValues } from '../termdb.boxplot.ts'

/**
 * Tests
 *  - parseValues()
 */

const mockTerm1$id = 'ansdkfljas-+'
const mockTerm2$id = 'asldkfj-+'
const mockSampleType = 'All samples'

const mockRequest = {
	tw: { term: termjson.agedx, $id: mockTerm1$id },
	overlayTw: { term: termjson.sex, $id: mockTerm2$id }
}

const mockGetDataResponse = {
	sampleType: {
		plural_name: 'samples'
	},
	refs: {
		bySampleId: {},
		byTermId: {}
	},
	samples: {
		1: {
			sample: '80',
			[mockTerm1$id]: { key: 1, value: 1 },
			[mockTerm2$id]: { key: 'Male', value: 'M' }
		},
		2: {
			sample: '81',
			[mockTerm1$id]: { key: 1.75, value: 1.75 },
			[mockTerm2$id]: { key: 'Female', value: 'F' }
		},
		3: {
			sample: '82',
			[mockTerm1$id]: { key: 3, value: 3 },
			[mockTerm2$id]: { key: 'Female', value: 'F' }
		},
		4: {
			sample: '83',
			[mockTerm1$id]: { key: -1, value: -1 },
			[mockTerm2$id]: { key: 'Male', value: 'M' }
		}
	}
}

tape('parseValues()', test => {
	test.timeoutAfter(100)

	let result, key2valuesMap, expected

	result = parseValues(mockRequest, mockGetDataResponse as any, mockSampleType, false)
	key2valuesMap = new Map()
	key2valuesMap.set(mockSampleType, [1, 1.75, 3, -1])
	expected = {
		absMax: 3,
		absMin: -1,
		key2values: key2valuesMap,
		uncomputableValues: {}
	}
	test.deepEqual(result, expected, 'Should parse all values correctly')

	result = parseValues(mockRequest, mockGetDataResponse as any, mockSampleType, true)
	key2valuesMap = new Map()
	key2valuesMap.set(mockSampleType, [1, 1.75, 3])
	expected = {
		absMax: 3,
		absMin: 1,
		key2values: key2valuesMap,
		uncomputableValues: {}
	}

	test.deepEqual(result, expected, 'Should parse values correctly and remove negative values for log scales')

	result = parseValues(mockRequest, mockGetDataResponse as any, mockSampleType, false, mockRequest.overlayTw)
	key2valuesMap = new Map()
	key2valuesMap.set('Male', [1, -1])
	key2valuesMap.set('Female', [1.75, 3])
	expected = {
		absMax: 3,
		absMin: -1,
		key2values: key2valuesMap,
		uncomputableValues: {}
	}

	test.deepEqual(result, expected, 'Should create key2values map for overlay term')

	test.end()
})
