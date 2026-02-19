import tape from 'tape'
import { getInterpolatedDomainRange, removeOutliers, removeInterpolatedOutliers } from '../colorScale.helpers.ts'
import { interpolateReds, interpolateBlues } from 'd3-scale-chromatic'

/**************
 test sections
***************/

tape('\n', test => {
	test.comment('-***- dom/ColorScale/colorScale.helpers.ts -***-')
	test.end()
})

tape('getInterpolatedDomainRange()', test => {
	test.timeoutAfter(100)

	{
		const result = getInterpolatedDomainRange({
			absMax: 50,
			absMin: 0,
			totalNumSteps: 10,
			negInterpolator: interpolateBlues,
			posInterpolator: interpolateReds
		})
		test.deepEqual(
			result,
			{
				domain: [-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50],
				range: [
					'rgb(8, 48, 107)',
					'rgb(24, 100, 170)',
					'rgb(75, 151, 201)',
					'rgb(147, 195, 223)',
					'rgb(207, 225, 242)',
					'white',
					'rgb(253, 201, 180)',
					'rgb(252, 138, 107)',
					'rgb(239, 69, 51)',
					'rgb(187, 21, 26)',
					'rgb(103, 0, 13)'
				]
			},
			`should give the expected interpolated domain and range for combined negative and positive inputs`
		)
		test.equal(
			result.domain.length,
			result.range.length,
			`should have equal # entries for numeric domain and color range`
		)
		test.equal(result.domain.length, new Set(result.domain).size, `should have only unique domain values`)
		test.equal(result.range.length, new Set(result.range).size, `should have only unique range values`)
	}

	{
		const result = getInterpolatedDomainRange({
			absMax: 50,
			absMin: 0,
			totalNumSteps: 10,
			posInterpolator: interpolateReds
		})
		test.deepEqual(
			result,
			{
				domain: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50],
				range: [
					'rgb(255, 245, 240)',
					'rgb(254, 227, 214)',
					'rgb(253, 201, 180)',
					'rgb(252, 170, 142)',
					'rgb(252, 138, 107)',
					'rgb(249, 105, 76)',
					'rgb(239, 69, 51)',
					'rgb(217, 39, 35)',
					'rgb(187, 21, 26)',
					'rgb(151, 11, 19)',
					'rgb(103, 0, 13)'
				]
			},
			`should give the expected interpolated domain and range for positive inputs`
		)
		test.equal(
			result.domain.length,
			result.range.length,
			`should have equal # entries for positive domain and color range`
		)
		test.equal(result.domain.length, new Set(result.domain).size, `should have only unique domain values`)
		test.equal(result.range.length, new Set(result.range).size, `should have only unique range values`)
	}

	{
		const result = getInterpolatedDomainRange({
			absMax: 50,
			absMin: 0,
			totalNumSteps: 10,
			negInterpolator: interpolateBlues
		})
		test.deepEqual(
			result,
			{
				domain: [-50, -45, -40, -35, -30, -25, -20, -15, -10, -5, 0],
				range: [
					'rgb(8, 48, 107)',
					'rgb(10, 74, 144)',
					'rgb(24, 100, 170)',
					'rgb(47, 126, 188)',
					'rgb(75, 151, 201)',
					'rgb(109, 174, 213)',
					'rgb(147, 195, 223)',
					'rgb(181, 212, 233)',
					'rgb(207, 225, 242)',
					'rgb(227, 238, 249)',
					'rgb(247, 251, 255)'
				]
			},
			`should give the expected interpolated domain and range for negative inputs`
		)
		test.equal(
			result.domain.length,
			result.range.length,
			`should have equal # entries for negative domain and color range`
		)
		test.equal(result.domain.length, new Set(result.domain).size, `should have only unique domain values`)
		test.equal(result.range.length, new Set(result.range).size, `should have only unique range values`)
	}

	{
		const result = getInterpolatedDomainRange({
			absMax: 0.0025,
			absMin: 0,
			totalNumSteps: 15,
			negInterpolator: interpolateBlues,
			posInterpolator: interpolateReds
		})
		test.deepEqual(
			result,
			{
				domain: [
					-0.0025, -0.0021666666666666666, -0.0018333333333333333, -0.0015, -0.0011666666666666668,
					-0.0008333333333333335, -0.0005000000000000002, -0.0001666666666666669, 0, 0.0003333333333333333,
					0.0006666666666666666, 0.001, 0.0013333333333333333, 0.0016666666666666666, 0.002, 0.0023333333333333335,
					0.0025
				],
				range: [
					'rgb(8, 48, 107)',
					'rgb(13, 83, 154)',
					'rgb(38, 118, 182)',
					'rgb(75, 151, 201)',
					'rgb(121, 181, 217)',
					'rgb(171, 207, 230)',
					'rgb(207, 225, 242)',
					'rgb(234, 242, 251)',
					'white',
					'rgb(254, 219, 204)',
					'rgb(252, 181, 155)',
					'rgb(252, 138, 107)',
					'rgb(247, 93, 67)',
					'rgb(226, 48, 40)',
					'rgb(187, 21, 26)',
					'rgb(135, 8, 17)',
					'rgb(103, 0, 13)'
				]
			},
			`should give the expected interpolated domain and range for combined negative and positive inputs`
		)
		test.equal(
			result.domain.length,
			result.range.length,
			`should have equal # entries for numeric domain and color range`
		)
		test.equal(result.domain.length, new Set(result.domain).size, `should have only unique domain values`)
		test.equal(result.range.length, new Set(result.range).size, `should have only unique range values`)
	}

	test.end()
})

tape('removeOutliers() auto-generated domain', test => {
	test.timeoutAfter(100)
	const data: number[] = []
	for (let i = 0; i < 499; i++) {
		data.push(i)
	}
	test.deepEqual(removeOutliers(data), data.slice(4, 495), `should remove the default top and bottom 1%`)
	test.deepEqual(
		removeOutliers(data, { minPercentile: 0.05, maxPercentile: 0.95, baseValue: 0 }),
		data.slice(0, 475),
		`should remove the top 5%`
	)
	test.end()
})

tape('removeOutliers() manually generated domain', test => {
	test.timeoutAfter(100)
	let minPercentile: number, maxPercentile: number, expected: number[], result: number[]
	const mockDomain = [
		-100, -0.8999999999999999, -0.7999999999999997, -0.6999999999999996, -0.5999999999999994, -0.49999999999999933,
		-0.3999999999999992, -0.2999999999999991, -0.19999999999999896, -0.09999999999999888, 0.08, 0.18000000000000005,
		0.2800000000000002, 0.38000000000000034, 0.4800000000000004, 0.5800000000000005, 0.6800000000000006,
		0.7800000000000008, 0.8800000000000009, 0.9800000000000011, 100
	]
	result = removeOutliers(mockDomain)
	test.deepEqual(result, mockDomain, `Should not remove outliers for such a small domain`)

	minPercentile = 0.05
	maxPercentile = 0.95
	result = removeOutliers(mockDomain, { minPercentile, maxPercentile })
	expected = [
		-0.8999999999999999, -0.7999999999999997, -0.6999999999999996, -0.5999999999999994, -0.49999999999999933,
		-0.3999999999999992, -0.2999999999999991, -0.19999999999999896, -0.09999999999999888, 0.08, 0.18000000000000005,
		0.2800000000000002, 0.38000000000000034, 0.4800000000000004, 0.5800000000000005, 0.6800000000000006,
		0.7800000000000008, 0.8800000000000009, 0.9800000000000011
	]
	test.deepEqual(
		result,
		expected,
		`Should remove the extreme outliers from the domain with a ${minPercentile}% and ${maxPercentile}% cutoff`
	)

	minPercentile = 0.25
	maxPercentile = 0.75
	result = removeOutliers(mockDomain, { minPercentile, maxPercentile })
	expected = [
		-0.49999999999999933, -0.3999999999999992, -0.2999999999999991, -0.19999999999999896, -0.09999999999999888, 0.08,
		0.18000000000000005, 0.2800000000000002, 0.38000000000000034, 0.4800000000000004, 0.5800000000000005
	]
	test.deepEqual(
		result,
		expected,
		`Should remove the extreme outliers from the domain with a ${minPercentile}% and ${maxPercentile}% cutoff`
	)

	test.end()
})

tape('removeOutliers() manually generated domain with baseValue', test => {
	test.timeoutAfter(100)
	let result: number[]
	const mockDomain = [
		-100, -0.8999999999999999, -0.7999999999999997, -0.6999999999999996, -0.5999999999999994, -0.49999999999999933,
		-0.3999999999999992, -0.2999999999999991, -0.19999999999999896, -0.09999999999999888, 0, 0.08, 0.18000000000000005,
		0.2800000000000002, 0.38000000000000034, 0.4800000000000004, 0.5800000000000005, 0.6800000000000006,
		0.7800000000000008, 0.8800000000000009, 0.9800000000000011, 100
	]
	result = removeOutliers(mockDomain, { baseValue: 0 })
	test.deepEqual(result, mockDomain, `Should not remove outliers for such a small domain`)

	const minPercentile = 0.05
	const maxPercentile = 0.95
	result = removeOutliers(mockDomain, { minPercentile, maxPercentile, baseValue: 0 })
	const expected = [
		-0.8999999999999999, -0.7999999999999997, -0.6999999999999996, -0.5999999999999994, -0.49999999999999933,
		-0.3999999999999992, -0.2999999999999991, -0.19999999999999896, -0.09999999999999888, 0, 0.08, 0.18000000000000005,
		0.2800000000000002, 0.38000000000000034, 0.4800000000000004, 0.5800000000000005, 0.6800000000000006,
		0.7800000000000008, 0.8800000000000009, 0.9800000000000011
	]
	test.deepEqual(
		result,
		expected,
		`Should remove the extreme outliers from the domain with a ${minPercentile}% and ${maxPercentile}% cutoff while keeping the baseValue`
	)

	test.end()
})

tape('removeOutliers() with minimal calculated array', test => {
	test.timeoutAfter(100)
	const mockDomain = [
		-10000000000, -100, -5, -4, -3, -2, -1, -0.75, -0.5, -0.25, 0.001, 0.5, 0.75, 1, 2, 3, 4, 5, 100, 10000000000
	]
	const result = removeOutliers(mockDomain, { minPercentile: 0.5, maxPercentile: 0.45 })
	const expected = [-0.25, 0.001, 0.5]
	test.deepEqual(
		result,
		expected,
		`Should return a calculated array with the closest value and values on either side of the closest value. `
	)
	test.end()
})

tape('removeInterpolatedOutliers()', test => {
	test.timeoutAfter(100)

	type SharedObj = { domain: number[]; range: string[] }
	let minPercent: number, maxPercent: number, expected: SharedObj, result: SharedObj
	const mockDomainRange = {
		domain: [-10000000000, -100, -5, -4, -3, -2, -1, -0.75, -0.5, -0.25, 0, 0.5, 0.75, 1, 2, 3, 4, 5, 100, 10000000000],
		range: [
			'#33FF57',
			'#FF33F3',
			'#3357FF',
			'#F3FF33',
			'#FF33A1',
			'#33FFF6',
			'#A133FF',
			'#FF7F33',
			'#33FF7F',
			'#7F33FF',
			'#FF337A',
			'#33FFA1',
			'#A1FF33',
			'#FF33F3',
			'#33A1FF',
			'#F633FF',
			'#FFA133',
			'#33F6FF',
			'#7AFF33',
			'#33F6FF'
		]
	}
	result = removeInterpolatedOutliers(mockDomainRange)
	test.deepEqual(result, mockDomainRange, `Should not remove outliers for such a small domain`)

	minPercent = 0.05
	maxPercent = 0.95
	result = removeInterpolatedOutliers(mockDomainRange, minPercent, maxPercent)
	expected = {
		domain: [-100, -5, -4, -3, -2, -1, -0.75, -0.5, -0.25, 0, 0.5, 0.75, 1, 2, 3, 4, 5, 100, 10000000000],
		range: [
			'#FF33F3',
			'#3357FF',
			'#F3FF33',
			'#FF33A1',
			'#33FFF6',
			'#A133FF',
			'#FF7F33',
			'#33FF7F',
			'#7F33FF',
			'#FF337A',
			'#33FFA1',
			'#A1FF33',
			'#FF33F3',
			'#33A1FF',
			'#F633FF',
			'#FFA133',
			'#33F6FF',
			'#7AFF33',
			'#33F6FF'
		]
	}
	test.deepEqual(
		result,
		expected,
		`Should remove the extreme outliers from the domain and range with a ${minPercent}% and ${maxPercent}% cutoff`
	)

	minPercent = 0.25
	maxPercent = 0.75
	result = removeInterpolatedOutliers(mockDomainRange, minPercent, maxPercent)
	expected = {
		domain: [-2, -1, -0.75, -0.5, -0.25, 0, 0.5, 0.75, 1, 2, 3],
		range: [
			'#33FFF6',
			'#A133FF',
			'#FF7F33',
			'#33FF7F',
			'#7F33FF',
			'#FF337A',
			'#33FFA1',
			'#A1FF33',
			'#FF33F3',
			'#33A1FF',
			'#F633FF'
		]
	}
	test.deepEqual(
		result,
		expected,
		`Should remove the extreme outliers from the domain and range with a ${minPercent}% and ${maxPercent}% cutoff`
	)

	test.end()
})
