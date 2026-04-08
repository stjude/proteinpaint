import tape from 'tape'
import { termjson } from '../../test/testdata/termjson.js'
import {
	parseValues,
	numericBins,
	sortPlot2Values,
	extractNumericValues,
	buildBins,
	computeSampleType,
	sortObj,
	setScaleData,
	setViolinResponse,
	setPlotData,
	setIndividualBoxPlotStats,
	setHiddenPlots,
	setUncomputableValues,
	divideValues,
	expandNumericTermCollection
} from '../termdb.violinBox.ts'
import {
	mockTerm1$id,
	mockTerm2$id,
	mockTerm3$id,
	mockTermCollectionId,
	mockSampleType,
	mockTw,
	mockOverlayTw,
	mockSamples,
	getMockData,
	getMockTermCollectionQ,
	getMockTermCollectionData
} from './mockViolinBoxData.ts'

/**
 * Tests
 *  - extractNumericValues()
 *  - computeSampleType()
 *  - numericBins()
 *  - buildBins()
 *  - sortPlot2Values()
 *  - sortObj()
 *  - setScaleData()
 *  - setViolinResponse()
 *  - setPlotData()
 *  - setIndividualBoxPlotStats()
 *  - setHiddenPlots()
 *  - setUncomputableValues()
 *  - parseValues() with uncomputable values
 *  - parseValues() with divideTw
 *  - expandNumericTermCollection()
 */

/**************
 extractNumericValues
***************/

tape('\n', function (test) {
	test.comment('-***- #routes/termdb.violinBox shared helpers -***-')
	test.end()
})

tape('extractNumericValues: extracts numeric values', function (test) {
	const samples = Object.values(mockSamples)
	const result = extractNumericValues(samples, mockTw as any)
	test.deepEqual(result, [5, 10, -3, 0], 'Should return all numeric values')
	test.end()
})

tape('extractNumericValues: filters non-positive values when isLogScale=true', function (test) {
	const samples = Object.values(mockSamples)
	const result = extractNumericValues(samples, mockTw as any, true)
	test.deepEqual(result, [5, 10], 'Should only return positive values for log scale')
	test.end()
})

tape('extractNumericValues: filters uncomputable values', function (test) {
	const twWithUncomputable = {
		term: {
			...termjson.agedx,
			values: { 5: { label: 'Unknown', uncomputable: true } }
		},
		$id: mockTerm1$id
	}
	const samples = Object.values(mockSamples)
	const result = extractNumericValues(samples, twWithUncomputable as any)
	test.deepEqual(result, [10, -3, 0], 'Should exclude uncomputable values')
	test.end()
})

tape('extractNumericValues: handles empty samples', function (test) {
	const result = extractNumericValues([], mockTw as any)
	test.deepEqual(result, [], 'Should return empty array for no samples')
	test.end()
})

tape('extractNumericValues: filters non-numeric values', function (test) {
	const samples = [
		{ [mockTerm1$id]: { key: 5, value: 5 } },
		{ [mockTerm1$id]: { key: 'N/A', value: 'N/A' } },
		{ [mockTerm1$id]: { key: null, value: null } },
		{ [mockTerm1$id]: { key: 3, value: 3 } }
	]
	const result = extractNumericValues(samples, mockTw as any)
	test.deepEqual(result, [5, 3], 'Should only include numeric values')
	test.end()
})

/**************
 computeSampleType
***************/

tape('computeSampleType: uses plural_name when available', function (test) {
	const data = { sampleType: { plural_name: 'patients' } } as any
	test.equal(computeSampleType(data), 'All patients', 'Should use plural_name')
	test.end()
})

tape('computeSampleType: defaults to "samples" when plural_name missing', function (test) {
	const data = { sampleType: {} } as any
	test.equal(computeSampleType(data), 'All samples', 'Should default to "samples"')
	test.end()
})

tape('computeSampleType: defaults to "samples" when sampleType missing', function (test) {
	const data = {} as any
	test.equal(computeSampleType(data), 'All samples', 'Should default to "samples"')
	test.end()
})

/**************
 numericBins
***************/

tape('numericBins: returns bins keyed by label', function (test) {
	const tw = { term: { type: 'float', id: 'agedx' }, $id: 'tw1' } as any
	const bins = [
		{ label: '0-5', start: 0, stop: 5 },
		{ label: '5-10', start: 5, stop: 10 }
	]
	const data = { refs: { bySampleId: {}, byTermId: { tw1: { bins } } }, samples: {} } as any
	const result = numericBins(tw, data)
	test.equal(Object.keys(result).length, 2, 'Should have 2 bins')
	test.deepEqual(result['0-5'], bins[0], 'First bin should match')
	test.deepEqual(result['5-10'], bins[1], 'Second bin should match')
	test.end()
})

tape('numericBins: returns empty object for non-numeric term', function (test) {
	const tw = { term: { type: 'categorical', id: 'sex' }, $id: 'tw1' } as any
	const data = getMockData({})
	const result = numericBins(tw, data)
	test.deepEqual(result, {}, 'Should return empty object for categorical term')
	test.end()
})

tape('numericBins: returns empty object when no bins in refs', function (test) {
	const tw = { term: { type: 'float', id: 'agedx' }, $id: 'tw1' } as any
	const data = { refs: { bySampleId: {}, byTermId: { tw1: {} } }, samples: {} } as any
	const result = numericBins(tw, data)
	test.deepEqual(result, {}, 'Should return empty object when bins are missing')
	test.end()
})

/**************
 buildBins
***************/

tape('buildBins: builds term1 bins only when no overlay or divide', function (test) {
	const tw = { term: { type: 'float', id: 't1' }, $id: 't1' } as any
	const bins = [{ label: 'a', start: 0, stop: 1 }]
	const data = { refs: { bySampleId: {}, byTermId: { t1: { bins } } }, samples: {} } as any
	const result = buildBins(tw, data)
	test.ok(result.term1, 'Should have term1')
	test.notOk(result.term2, 'Should not have term2')
	test.notOk(result.term0, 'Should not have term0')
	test.end()
})

tape('buildBins: includes term2 for overlay and term0 for divide', function (test) {
	const tw = { term: { type: 'float', id: 't1' }, $id: 't1' } as any
	const overlayTw = { term: { type: 'float', id: 't2' }, $id: 't2' } as any
	const divideTw = { term: { type: 'float', id: 't3' }, $id: 't3' } as any
	const data = {
		refs: {
			bySampleId: {},
			byTermId: {
				t1: { bins: [{ label: 'a' }] },
				t2: { bins: [{ label: 'b' }] },
				t3: { bins: [{ label: 'c' }] }
			}
		},
		samples: {}
	} as any
	const result = buildBins(tw, data, overlayTw, divideTw)
	test.ok(result.term1, 'Should have term1')
	test.ok(result.term2, 'Should have term2 for overlay')
	test.ok(result.term0, 'Should have term0 for divide')
	test.end()
})

/**************
 sortPlot2Values
***************/

tape('sortPlot2Values: sorts categorical overlay by count descending', function (test) {
	const plot2values = new Map<string, any[]>([
		['groupA', [1, 2]],
		['groupB', [1, 2, 3, 4, 5]],
		['groupC', [1, 2, 3]]
	])
	const overlayTerm = { term: { type: 'categorical' } } as any
	const data = { refs: { bySampleId: {}, byTermId: {} } } as any
	const sorted = sortPlot2Values(data, plot2values, overlayTerm)
	const keys = [...sorted.keys()]
	test.deepEqual(keys, ['groupB', 'groupC', 'groupA'], 'Should sort by value count descending')
	test.end()
})

tape('sortPlot2Values: sorts condition overlay numerically', function (test) {
	const plot2values = new Map<string, any[]>([
		['3', [1]],
		['1', [1]],
		['2', [1]]
	])
	const overlayTerm = { term: { type: 'condition' } } as any
	const data = { refs: { bySampleId: {}, byTermId: {} } } as any
	const sorted = sortPlot2Values(data, plot2values, overlayTerm)
	const keys = [...sorted.keys()]
	test.deepEqual(keys, ['1', '2', '3'], 'Should sort numerically for condition terms')
	test.end()
})

tape('sortPlot2Values: uses orderedLabels when available', function (test) {
	const plot2values = new Map<string, any[]>([
		['C', [1]],
		['A', [1]],
		['B', [1]]
	])
	const overlayTerm = { term: { type: 'categorical' }, $id: 'ov1' } as any
	const data = {
		refs: { bySampleId: {}, byTermId: { ov1: { keyOrder: ['A', 'B', 'C'] } } }
	} as any
	const sorted = sortPlot2Values(data, plot2values, overlayTerm)
	const keys = [...sorted.keys()]
	test.deepEqual(keys, ['A', 'B', 'C'], 'Should follow keyOrder when provided')
	test.end()
})

/**************
 parseValues - uncomputable tracking
***************/

tape('parseValues: tracks uncomputable values in legend', function (test) {
	test.timeoutAfter(100)

	const uncomputableTerm = {
		...termjson.agedx,
		values: {
			99: { label: 'Not reported', uncomputable: true }
		}
	}
	const tw = { term: uncomputableTerm, $id: mockTerm1$id }
	const samples = {
		1: { sample: '1', [mockTerm1$id]: { key: 5, value: 5 } },
		2: { sample: '2', [mockTerm1$id]: { key: 99, value: 99 } },
		3: { sample: '3', [mockTerm1$id]: { key: 99, value: 99 } },
		4: { sample: '4', [mockTerm1$id]: { key: 10, value: 10 } }
	}
	const data = getMockData(samples)

	const result = parseValues({ tw }, data, mockSampleType, false)
	test.equal(result.uncomputableValues['Not reported'], 2, 'Should count 2 uncomputable "Not reported" values')
	test.equal(result.absMin, 5, 'absMin should exclude uncomputable values')
	test.equal(result.absMax, 10, 'absMax should exclude uncomputable values')

	const plot2values = result.chart2plot2values.get('')
	const values = plot2values.get(mockSampleType)
	test.deepEqual(values, [5, 10], 'Should exclude uncomputable values from plot values')
	test.end()
})

/**************
 parseValues - divide term
***************/

tape('parseValues: splits into charts by divideTw', function (test) {
	test.timeoutAfter(100)

	const divideTw = { term: { type: 'categorical', values: {} }, $id: mockTerm3$id }
	const samples = {
		1: {
			sample: '1',
			[mockTerm1$id]: { key: 5, value: 5 },
			[mockTerm3$id]: { key: 'GroupA', value: 'A' }
		},
		2: {
			sample: '2',
			[mockTerm1$id]: { key: 10, value: 10 },
			[mockTerm3$id]: { key: 'GroupB', value: 'B' }
		},
		3: {
			sample: '3',
			[mockTerm1$id]: { key: 3, value: 3 },
			[mockTerm3$id]: { key: 'GroupA', value: 'A' }
		}
	}
	const data = getMockData(samples)

	const result = parseValues({ tw: mockTw }, data, mockSampleType, false, undefined, divideTw)
	test.equal(result.chart2plot2values.size, 2, 'Should create 2 charts')
	test.ok(result.chart2plot2values.has('GroupA'), 'Should have GroupA chart')
	test.ok(result.chart2plot2values.has('GroupB'), 'Should have GroupB chart')

	const groupA = result.chart2plot2values.get('GroupA').get(mockSampleType)
	test.deepEqual(groupA, [5, 3], 'GroupA should have values [5, 3]')

	const groupB = result.chart2plot2values.get('GroupB').get(mockSampleType)
	test.deepEqual(groupB, [10], 'GroupB should have values [10]')
	test.end()
})

/**************
 parseValues - overlay + divide combined
***************/

tape('parseValues: combines overlay and divide terms', function (test) {
	test.timeoutAfter(100)

	const divideTw = { term: { type: 'categorical', values: {} }, $id: mockTerm3$id }
	const samples = {
		1: {
			sample: '1',
			[mockTerm1$id]: { key: 5, value: 5 },
			[mockTerm2$id]: { key: 'Male', value: 'M' },
			[mockTerm3$id]: { key: 'ChartA', value: 'A' }
		},
		2: {
			sample: '2',
			[mockTerm1$id]: { key: 10, value: 10 },
			[mockTerm2$id]: { key: 'Female', value: 'F' },
			[mockTerm3$id]: { key: 'ChartA', value: 'A' }
		},
		3: {
			sample: '3',
			[mockTerm1$id]: { key: 7, value: 7 },
			[mockTerm2$id]: { key: 'Male', value: 'M' },
			[mockTerm3$id]: { key: 'ChartB', value: 'B' }
		}
	}
	const data = getMockData(samples)

	const result = parseValues({ tw: mockTw }, data, mockSampleType, false, mockOverlayTw, divideTw)
	test.equal(result.chart2plot2values.size, 2, 'Should create 2 charts')

	const chartA = result.chart2plot2values.get('ChartA')
	test.ok(chartA.has('Male'), 'ChartA should have Male plot')
	test.ok(chartA.has('Female'), 'ChartA should have Female plot')
	test.deepEqual(chartA.get('Male'), [5], 'ChartA Male should have [5]')
	test.deepEqual(chartA.get('Female'), [10], 'ChartA Female should have [10]')

	const chartB = result.chart2plot2values.get('ChartB')
	test.deepEqual(chartB.get('Male'), [7], 'ChartB Male should have [7]')
	test.end()
})

/**************
 parseValues - log scale
***************/

tape('parseValues: filters non-positive values when isLog=true', function (test) {
	test.timeoutAfter(100)

	const samples = {
		1: { sample: '1', [mockTerm1$id]: { key: 5, value: 5 } },
		2: { sample: '2', [mockTerm1$id]: { key: 0, value: 0 } },
		3: { sample: '3', [mockTerm1$id]: { key: -2, value: -2 } },
		4: { sample: '4', [mockTerm1$id]: { key: 100, value: 100 } }
	}
	const data = getMockData(samples)

	const result = parseValues({ tw: mockTw }, data, mockSampleType, true)
	const values = result.chart2plot2values.get('').get(mockSampleType)
	test.deepEqual(values, [5, 100], 'Should only include positive values')
	test.equal(result.absMin, 5, 'absMin should be 5')
	test.equal(result.absMax, 100, 'absMax should be 100')
	test.end()
})

/**************
 parseValues - samples with missing term data
***************/

tape('parseValues: skips samples missing term data', function (test) {
	test.timeoutAfter(100)

	const samples = {
		1: { sample: '1', [mockTerm1$id]: { key: 5, value: 5 } },
		2: { sample: '2' }, // missing term data entirely
		3: { sample: '3', [mockTerm1$id]: { key: 'text', value: 'text' } }, // non-numeric
		4: { sample: '4', [mockTerm1$id]: { key: 8, value: 8 } }
	}
	const data = getMockData(samples)

	const result = parseValues({ tw: mockTw }, data, mockSampleType, false)
	const values = result.chart2plot2values.get('').get(mockSampleType)
	test.deepEqual(values, [5, 8], 'Should only include samples with valid numeric term data')
	test.end()
})

/**************
 sortObj
***************/

tape('sortObj: sorts object entries by numeric value ascending', function (test) {
	const result = sortObj({ banana: 3, apple: 1, cherry: 2 })
	test.deepEqual(Object.keys(result), ['apple', 'cherry', 'banana'], 'Should sort keys by value ascending')
	test.deepEqual(Object.values(result), [1, 2, 3], 'Values should be in ascending order')
	test.end()
})

tape('sortObj: handles empty object', function (test) {
	const result = sortObj({})
	test.deepEqual(result, {}, 'Should return empty object')
	test.end()
})

tape('sortObj: handles single entry', function (test) {
	const result = sortObj({ only: 42 })
	test.deepEqual(result, { only: 42 }, 'Should return same single-entry object')
	test.end()
})

/**************
 setScaleData
***************/

tape('setScaleData: divides values by scale factor', function (test) {
	const q = { scale: 2 } as any
	const tw = { $id: 'tw1', term: { values: {} } } as any
	const data = {
		samples: {
			s1: { tw1: { key: 10, value: 10 } },
			s2: { tw1: { key: 20, value: 20 } }
		}
	} as any

	setScaleData(q, data, tw)
	test.equal(data.samples.s1.tw1.value, 5, 'First sample value should be 10/2=5')
	test.equal(data.samples.s1.tw1.key, 5, 'First sample key should be 10/2=5')
	test.equal(data.samples.s2.tw1.value, 10, 'Second sample value should be 20/2=10')
	test.end()
})

tape('setScaleData: skips uncomputable values', function (test) {
	const q = { scale: 2 } as any
	const tw = { $id: 'tw1', term: { values: { 99: { uncomputable: true } } } } as any
	const data = {
		samples: {
			s1: { tw1: { key: 10, value: 10 } },
			s2: { tw1: { key: 99, value: 99 } }
		}
	} as any

	setScaleData(q, data, tw)
	test.equal(data.samples.s1.tw1.value, 5, 'Computable value should be scaled')
	test.equal(data.samples.s2.tw1.value, 99, 'Uncomputable value should remain unchanged')
	test.end()
})

tape('setScaleData: no-ops when scale is not set', function (test) {
	const q = {} as any
	const tw = { $id: 'tw1', term: { values: {} } } as any
	const data = { samples: { s1: { tw1: { key: 10, value: 10 } } } } as any

	setScaleData(q, data, tw)
	test.equal(data.samples.s1.tw1.value, 10, 'Value should remain unchanged')
	test.end()
})

/**************
 setViolinResponse
***************/

tape('setViolinResponse: builds charts with plots from chart2plot2values', function (test) {
	const plot2values = new Map([
		['Male', [1, 2, 3]],
		['Female', [4, 5]]
	])
	const chart2plot2values = new Map([['', plot2values]])
	const valuesObject = {
		chart2plot2values,
		min: 1,
		max: 5,
		uncomputableValues: {}
	}
	const data = { refs: { bySampleId: {}, byTermId: {} } } as any
	const q = { tw: mockTw } as any

	const result = setViolinResponse(valuesObject, data, q)
	test.equal(result.min, 1, 'min should be 1')
	test.equal(result.max, 5, 'max should be 5')
	test.ok(result.charts[''], 'Should have default chart')
	test.equal(result.charts[''].plots.length, 2, 'Chart should have 2 plots')
	const totalValues = result.charts[''].plots.reduce((sum, p) => sum + p.plotValueCount, 0)
	test.equal(totalValues, 5, 'Total values across plots should be 5')
	test.end()
})

tape('setViolinResponse: uses overlay term labels and colors', function (test) {
	const overlayTw = {
		term: {
			type: 'categorical',
			values: {
				M: { label: 'Male', color: '#0000ff' },
				F: { label: 'Female', color: '#ff0000' }
			}
		},
		$id: 'ov1'
	} as any
	const plot2values = new Map([
		['M', [1, 2]],
		['F', [3, 4]]
	])
	const chart2plot2values = new Map([['', plot2values]])
	const valuesObject = { chart2plot2values, min: 1, max: 4, uncomputableValues: {} }
	const data = { refs: { bySampleId: {}, byTermId: {} } } as any
	const q = { tw: mockTw, overlayTw } as any

	const result = setViolinResponse(valuesObject, data, q)
	const plots = result.charts[''].plots
	test.equal(plots[0].label, 'Male', 'Should use overlay term label')
	test.equal(plots[0].color, '#0000ff', 'Should use overlay term color')
	test.equal(plots[1].label, 'Female', 'Should use overlay term label for second plot')
	test.equal(plots[1].color, '#ff0000', 'Should use overlay term color for second plot')
	test.end()
})

tape('setViolinResponse: returns null uncomputableValues when empty', function (test) {
	const chart2plot2values = new Map([['', new Map([['all', [1]]])]])
	const valuesObject = { chart2plot2values, min: 1, max: 1, uncomputableValues: {} }
	const data = { refs: { bySampleId: {}, byTermId: {} } } as any
	const q = { tw: mockTw } as any

	const result = setViolinResponse(valuesObject, data, q)
	test.equal(result.uncomputableValues, null, 'Should be null when no uncomputable values')
	test.end()
})

tape('setViolinResponse: returns uncomputableValues when present', function (test) {
	const chart2plot2values = new Map([['', new Map([['all', [1]]])]])
	const valuesObject = {
		chart2plot2values,
		min: 1,
		max: 1,
		uncomputableValues: { 'Not reported': 5 }
	}
	const data = { refs: { bySampleId: {}, byTermId: {} } } as any
	const q = { tw: mockTw } as any

	const result = setViolinResponse(valuesObject, data, q)
	test.deepEqual(result.uncomputableValues, { 'Not reported': 5 }, 'Should pass through uncomputable values')
	test.end()
})

/**************
 setIndividualBoxPlotStats
***************/

tape('setIndividualBoxPlotStats: formats boxplot stats correctly', function (test) {
	const boxplot = { p25: 3, p50: 5, p75: 8, p05: 1, p95: 10, w1: 1, w2: 10, iqr: 5, out: [] } as any
	const values = [1, 2, 3, 5, 7, 8, 10]

	const result = setIndividualBoxPlotStats(boxplot, values)
	test.equal(result.total.value, 7, 'Total should be 7')
	test.equal(result.total.label, 'Total', 'Total label should be "Total"')
	test.equal(result.min.value, 1, 'Min should be 1')
	test.equal(result.max.value, 10, 'Max should be 10')
	test.equal(result.p25.value, 3, 'p25 should be 3')
	test.equal(result.median.value, 5, 'Median should be 5')
	test.equal(result.p75.value, 8, 'p75 should be 8')
	test.ok(typeof result.mean.value === 'number', 'Mean should be a number')
	test.ok(typeof result.stdDev.value === 'number', 'StdDev should be a number')
	test.end()
})

tape('setIndividualBoxPlotStats: all entries have key and label', function (test) {
	const boxplot = { p25: 2, p50: 4, p75: 6, p05: 1, p95: 9, w1: 1, w2: 9, iqr: 4, out: [] } as any
	const values = [1, 2, 4, 6, 9]

	const result = setIndividualBoxPlotStats(boxplot, values)
	for (const [key, stat] of Object.entries(result)) {
		test.equal(stat.key, key, `stat.key should equal "${key}"`)
		test.ok(stat.label, `"${key}" should have a label`)
		test.ok(typeof stat.value === 'number', `"${key}" value should be a number`)
	}
	test.end()
})

/**************
 setHiddenPlots
***************/

tape('setHiddenPlots: marks uncomputable term values as hidden', function (test) {
	const term = {
		term: {
			values: {
				1: { label: 'Yes', uncomputable: false },
				99: { label: 'Unknown', uncomputable: true }
			}
		},
		q: {}
	} as any
	const plots = [
		{ key: 'Yes', boxplot: {}, descrStats: {} },
		{ key: 'Unknown', boxplot: {}, descrStats: {} }
	] as any

	setHiddenPlots(term, plots)
	test.notOk(plots[0].isHidden, '"Yes" plot should not be hidden')
	test.ok(plots[1].isHidden, '"Unknown" plot should be hidden')
	test.end()
})

tape('setHiddenPlots: marks hiddenValues from q as hidden', function (test) {
	const term = {
		term: { values: {} },
		q: { hiddenValues: { Male: true } }
	} as any
	const plots = [
		{ key: 'Male', boxplot: {}, descrStats: {} },
		{ key: 'Female', boxplot: {}, descrStats: {} }
	] as any

	setHiddenPlots(term, plots)
	test.ok(plots[0].isHidden, '"Male" plot should be hidden via hiddenValues')
	test.notOk(plots[1].isHidden, '"Female" plot should not be hidden')
	test.end()
})

tape('setHiddenPlots: ignores plots not found in term values', function (test) {
	const term = {
		term: { values: { 99: { label: 'Unknown', uncomputable: true } } },
		q: {}
	} as any
	const plots = [{ key: 'SomethingElse', boxplot: {}, descrStats: {} }] as any

	setHiddenPlots(term, plots)
	test.notOk(plots[0].isHidden, 'Plot not matching any term value should remain unchanged')
	test.end()
})

/**************
 setUncomputableValues
***************/

tape('setUncomputableValues: returns array of label/value objects', function (test) {
	const result = setUncomputableValues({ 'Not reported': 5, Unknown: 3 })
	test.ok(Array.isArray(result), 'Should return an array')
	test.equal(result!.length, 2, 'Should have 2 entries')
	test.ok(
		result!.some(r => r.label === 'Not reported' && r.value === 5),
		'Should include "Not reported" with value 5'
	)
	test.ok(
		result!.some(r => r.label === 'Unknown' && r.value === 3),
		'Should include "Unknown" with value 3'
	)
	test.end()
})

tape('setUncomputableValues: returns null for empty object', function (test) {
	const result = setUncomputableValues({})
	test.equal(result, null, 'Should return null for empty values')
	test.end()
})

/**************
 setPlotData
***************/

tape('setPlotData: creates box plot entry with correct stats', function (test) {
	const plots: any[] = []
	const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
	const descrStats = { total: { value: 10 } } as any
	const q = { removeOutliers: false } as any

	setPlotData(plots, values, 'testKey', mockSampleType, descrStats, q, Infinity, -Infinity)
	test.equal(plots.length, 1, 'Should push one plot')
	test.ok(plots[0].boxplot, 'Plot should have boxplot data')
	test.ok(plots[0].descrStats, 'Plot should have descrStats')
	test.equal(plots[0].key, mockSampleType, 'Plot key should be sampleType when no overlay')
	test.ok(plots[0].boxplot.label.includes(mockSampleType), 'Label should include sampleType')
	test.ok(plots[0].boxplot.label.includes('n=10'), 'Label should include sample count')
	test.end()
})

tape('setPlotData: uses overlay term label when overlayTw provided', function (test) {
	const plots: any[] = []
	const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
	const descrStats = { total: { value: 10 } } as any
	const q = { removeOutliers: false } as any
	const overlayTw = {
		term: { values: { M: { label: 'Male', color: '#0000ff' } } }
	} as any

	setPlotData(plots, values, 'M', mockSampleType, descrStats, q, Infinity, -Infinity, overlayTw)
	test.equal(plots[0].key, 'Male', 'Plot key should be overlay label')
	test.equal(plots[0].seriesId, 'M', 'seriesId should be the raw key')
	test.equal(plots[0].color, '#0000ff', 'Should use overlay color')
	test.ok(plots[0].boxplot.label.includes('Male'), 'Label should include overlay label')
	test.end()
})

tape('setPlotData: returns outlier bounds', function (test) {
	const plots: any[] = []
	const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
	const descrStats = { outlierMin: { value: 0 }, outlierMax: { value: 11 } } as any
	const q = { removeOutliers: true } as any

	const [outlierMax, outlierMin] = setPlotData(plots, values, 'k', mockSampleType, descrStats, q, Infinity, -Infinity)
	test.equal(outlierMin, 0, 'outlierMin should come from descrStats')
	test.equal(outlierMax, 11, 'outlierMax should come from descrStats')
	test.end()
})

tape('setPlotData: tempValues contains sorted values', function (test) {
	const plots: any[] = []
	const values = [5, 1, 9, 3, 7]
	const descrStats = { total: { value: 5 } } as any
	const q = { removeOutliers: false } as any

	setPlotData(plots, values, 'k', mockSampleType, descrStats, q, Infinity, -Infinity)
	test.deepEqual(plots[0].tempValues, [1, 3, 5, 7, 9], 'tempValues should be sorted ascending')
	test.end()
})

/**************
 divideValues
***************/

tape('divideValues: returns chart2plot2values, min, max, uncomputableValues', function (test) {
	const samples = {
		1: { [mockTerm1$id]: { key: 5, value: 5 } },
		2: { [mockTerm1$id]: { key: 10, value: 10 } },
		3: { [mockTerm1$id]: { key: 2, value: 2 } }
	}
	const data = getMockData(samples)
	const q = { tw: mockTw, isLogScale: false } as any

	const result = divideValues(q, data, mockSampleType)
	test.equal(result.min, 2, 'min should be 2')
	test.equal(result.max, 10, 'max should be 10')
	test.ok(result.chart2plot2values instanceof Map, 'chart2plot2values should be a Map')
	test.deepEqual(result.uncomputableValues, {}, 'uncomputableValues should be empty')
	test.end()
})

tape('divideValues: handles overlay term', function (test) {
	const samples = {
		1: { [mockTerm1$id]: { key: 5, value: 5 }, [mockTerm2$id]: { key: 'Male', value: 'M' } },
		2: { [mockTerm1$id]: { key: 10, value: 10 }, [mockTerm2$id]: { key: 'Female', value: 'F' } }
	}
	const data = getMockData(samples)
	const q = { tw: mockTw, overlayTw: mockOverlayTw, isLogScale: false } as any

	const result = divideValues(q, data, mockSampleType)
	const plot2values = result.chart2plot2values.get('')
	test.ok(plot2values.has('Male'), 'Should have Male plot')
	test.ok(plot2values.has('Female'), 'Should have Female plot')
	test.end()
})

tape('divideValues: sorts uncomputable values by count', function (test) {
	const term = {
		...termjson.agedx,
		values: {
			88: { label: 'Refused', uncomputable: true },
			99: { label: 'Unknown', uncomputable: true }
		}
	}
	const samples = {
		1: { [mockTerm1$id]: { key: 5, value: 5 } },
		2: { [mockTerm1$id]: { key: 99, value: 99 } },
		3: { [mockTerm1$id]: { key: 99, value: 99 } },
		4: { [mockTerm1$id]: { key: 99, value: 99 } },
		5: { [mockTerm1$id]: { key: 88, value: 88 } }
	}
	const data = getMockData(samples)
	const q = { tw: { term, $id: mockTerm1$id }, isLogScale: false } as any

	const result = divideValues(q, data, mockSampleType)
	const keys = Object.keys(result.uncomputableValues)
	test.equal(keys[0], 'Refused', 'Lower count should come first (sorted ascending)')
	test.equal(keys[1], 'Unknown', 'Higher count should come second')
	test.end()
})

/**************
 expandNumericTermCollection
***************/

tape('expandNumericTermCollection: expands samples into per-member-term entries', function (test) {
	const q = getMockTermCollectionQ()
	const data = getMockTermCollectionData()

	expandNumericTermCollection(q, data)

	const sampleKeys = Object.keys(data.samples)
	// 2 samples × 3 member terms = 6 virtual samples
	test.equal(sampleKeys.length, 6, 'Should create 6 virtual samples (2 samples × 3 drugs)')
	test.ok(sampleKeys.includes('s1__drugA'), 'Should have s1__drugA')
	test.ok(sampleKeys.includes('s2__drugC'), 'Should have s2__drugC')
	test.end()
})

tape('expandNumericTermCollection: sets plain numeric values under tw.$id', function (test) {
	const q = getMockTermCollectionQ()
	const data = getMockTermCollectionData()

	expandNumericTermCollection(q, data)

	test.equal(data.samples['s1__drugA'][mockTermCollectionId].value, 1.5, 'drugA value for s1 should be 1.5')
	test.equal(data.samples['s2__drugB'][mockTermCollectionId].value, 5.0, 'drugB value for s2 should be 5.0')
	test.end()
})

tape('expandNumericTermCollection: creates synthetic overlay keyed by member term name', function (test) {
	const q = getMockTermCollectionQ()
	const data = getMockTermCollectionData()

	expandNumericTermCollection(q, data)

	test.ok(q.overlayTw, 'Should set overlayTw on q')
	test.equal(q.overlayTw.$id, '__tcOverlay', 'Overlay $id should be __tcOverlay')
	test.equal(q.overlayTw.term.type, 'categorical', 'Overlay term type should be categorical')

	// Check overlay values have correct labels and colors
	test.equal(q.overlayTw.term.values['Drug A'].label, 'Drug A', 'Should use member term name as label')
	test.equal(q.overlayTw.term.values['Drug A'].color, '#ff0000', 'Should use color from propsByTermId')
	test.equal(q.overlayTw.term.values['Drug B'].color, '#00ff00', 'Should use color from propsByTermId')
	test.end()
})

tape('expandNumericTermCollection: sets overlay key on each virtual sample', function (test) {
	const q = getMockTermCollectionQ()
	const data = getMockTermCollectionData()

	expandNumericTermCollection(q, data)

	test.equal(data.samples['s1__drugA']['__tcOverlay'].key, 'Drug A', 'Overlay key should be member term name')
	test.equal(data.samples['s1__drugB']['__tcOverlay'].key, 'Drug B', 'Overlay key should be member term name')
	test.equal(data.samples['s2__drugC']['__tcOverlay'].key, 'Drug C', 'Overlay key should be member term name')
	test.end()
})

tape('expandNumericTermCollection: preserves termlst order in refs keyOrder', function (test) {
	const q = getMockTermCollectionQ()
	const data = getMockTermCollectionData()

	expandNumericTermCollection(q, data)

	const keyOrder = data.refs.byTermId['__tcOverlay'].keyOrder
	test.deepEqual(keyOrder, ['Drug A', 'Drug B', 'Drug C'], 'keyOrder should match termlst order')
	test.end()
})

tape('expandNumericTermCollection: skips non-finite member values', function (test) {
	const q = getMockTermCollectionQ()
	const data = {
		refs: { bySampleId: {}, byTermId: {} },
		samples: {
			s1: {
				sample: 's1',
				[mockTermCollectionId]: { key: 's1', value: { drugA: 1.0, drugB: NaN, drugC: Infinity } }
			}
		}
	} as any

	expandNumericTermCollection(q, data)

	const sampleKeys = Object.keys(data.samples)
	test.equal(sampleKeys.length, 1, 'Should only create 1 virtual sample (NaN and Infinity skipped)')
	test.ok(sampleKeys.includes('s1__drugA'), 'Should include the finite value')
	test.end()
})

tape('expandNumericTermCollection: skips samples with missing termCollection data', function (test) {
	const q = getMockTermCollectionQ()
	const data = {
		refs: { bySampleId: {}, byTermId: {} },
		samples: {
			s1: {
				sample: 's1',
				[mockTermCollectionId]: { key: 's1', value: { drugA: 1.0 } }
			},
			s2: {
				sample: 's2'
				// missing mockTermCollectionId entry entirely
			}
		}
	} as any

	expandNumericTermCollection(q, data)

	const sampleKeys = Object.keys(data.samples)
	test.equal(sampleKeys.length, 1, 'Should only expand sample with valid termCollection data')
	test.ok(sampleKeys.includes('s1__drugA'), 'Should include s1__drugA')
	test.end()
})

tape('expandNumericTermCollection: throws for non-numeric memberType', function (test) {
	const q = {
		tw: {
			$id: mockTermCollectionId,
			term: {
				type: 'termCollection',
				memberType: 'categorical',
				termlst: [],
				propsByTermId: {}
			},
			q: {}
		}
	} as any
	const data = getMockData({})

	test.throws(
		() => expandNumericTermCollection(q, data),
		/only numeric termCollection/,
		'Should throw for categorical memberType'
	)
	test.end()
})

tape('expandNumericTermCollection: throws when overlayTw is present', function (test) {
	const q = { ...getMockTermCollectionQ(), overlayTw: { $id: 'ov', term: { type: 'categorical' }, q: {} } }
	const data = getMockTermCollectionData()

	test.throws(
		() => expandNumericTermCollection(q, data),
		/overlayTw is not supported/,
		'Should throw when overlayTw is already set'
	)
	test.end()
})

tape('expandNumericTermCollection: throws when divideTw is present', function (test) {
	const q = { ...getMockTermCollectionQ(), divideTw: { $id: 'dv', term: { type: 'categorical' }, q: {} } }
	const data = getMockTermCollectionData()

	test.throws(
		() => expandNumericTermCollection(q, data),
		/divideTw is not supported/,
		'Should throw when divideTw is already set'
	)
	test.end()
})

tape('expandNumericTermCollection: expanded data works with parseValues', function (test) {
	const q = getMockTermCollectionQ()
	const data = getMockTermCollectionData()

	expandNumericTermCollection(q, data)

	// parseValues should now see plain numeric values with the synthetic overlay
	const result = parseValues({ tw: q.tw }, data, mockSampleType, false, q.overlayTw)

	test.equal(result.absMin, 1.5, 'absMin should be 1.5')
	test.equal(result.absMax, 6.0, 'absMax should be 6.0')

	const plot2values = result.chart2plot2values.get('')
	test.ok(plot2values.has('Drug A'), 'Should have Drug A plot')
	test.ok(plot2values.has('Drug B'), 'Should have Drug B plot')
	test.ok(plot2values.has('Drug C'), 'Should have Drug C plot')

	test.deepEqual(plot2values.get('Drug A').sort(), [1.5, 4.0], 'Drug A should have values from both samples')
	test.deepEqual(plot2values.get('Drug B').sort(), [2.5, 5.0], 'Drug B should have values from both samples')
	test.deepEqual(plot2values.get('Drug C').sort(), [3.5, 6.0], 'Drug C should have values from both samples')
	test.end()
})
