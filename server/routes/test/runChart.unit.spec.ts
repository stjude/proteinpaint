import tape from 'tape'
import { buildRunChartFromData } from '../termdb.runChart.ts'

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- #routes/termdb.runChart -***-')
	test.end()
})

tape('buildRunChartFromData() mean aggregation', function (test) {
	const aggregation = 'mean'
	const xTermId = 'x'
	const yTermId = 'y'

	const inputData = {
		samples: {
			s1: {
				[xTermId]: { value: 2023.8328767123287 },
				[yTermId]: { value: 10 }
			},
			s2: {
				[xTermId]: { value: 2023.8328767123287 },
				[yTermId]: { value: 20 }
			},
			s3: {
				[xTermId]: { value: 2020.62021857923 },
				[yTermId]: { value: 30 }
			}
		}
	}

	const expectedOutput = {
		status: 'ok',
		series: [
			{
				median: 22.5,
				points: [
					{
						x: 2020.08,
						xName: 'August 2020',
						y: 30,
						sampleCount: 1
					},
					{
						x: 2023.1,
						xName: 'October 2023',
						y: 15,
						sampleCount: 2
					}
				]
			}
		]
	}

	const output = buildRunChartFromData(aggregation, xTermId, yTermId, inputData)
	test.deepEqual(output, expectedOutput, 'output should match expected structure with 2 data points for two months')

	test.end()
})

tape('buildRunChartFromData() proportion aggregation', function (test) {
	const aggregation = 'proportion'
	const xTermId = 'x'
	const yTermId = 'y'

	const data = {
		samples: {
			s1: {
				[xTermId]: { value: 2023.8328767123287 },
				[yTermId]: { value: 20 }
			},
			s2: {
				[xTermId]: { value: 2023.7095890410958 },
				[yTermId]: { value: null }
			},
			s3: {
				[xTermId]: { value: 2020.62021857923 },
				[yTermId]: { value: 1 }
			}
		}
	}

	const result = buildRunChartFromData(aggregation, xTermId, yTermId, data)

	test.equal(result.status, 'ok', 'status should be ok')
	test.equal(result.series.length, 1, 'should return one series')

	const series = result.series[0]
	test.equal(series.points.length, 2, 'should have two monthly point')

	const p = series.points[0]
	test.equal(p.x, 2020.08, 'August x should be 2020.08')
	test.equal(p.xName, 'August 2020', 'point should be August 2020')
	test.equal(p.sampleCount, 1, 'total should be 3')
	test.equal(p.y, 1, 'proportion should be 2 successes / 3 total, rounded to 3 decimals')

	test.equal(series.median, 10.5, 'median with a single point should equal its y value (10.5)')

	test.end()
})

tape('buildRunChartFromData() count aggregation', function (test) {
	const aggregation = 'count'
	const xTermId = 'x'
	const yTermId = 'y'

	const data = {
		samples: {
			s1: {
				[xTermId]: { value: 2024.45987654321 },
				[yTermId]: { value: 5 }
			},
			s2: {
				[xTermId]: { value: 2024.256789012345 },
				[yTermId]: { value: 7 }
			}
		}
	}

	const result = buildRunChartFromData(aggregation, xTermId, yTermId, data)

	test.equal(result.status, 'ok', 'status should be ok')
	test.equal(result.series.length, 1, 'should return one series')

	const series = result.series[0]
	test.equal(series.points.length, 2, 'should have two monthly point')

	const p = series.points[0]
	test.equal(p.x, 2024.04, 'April x should be 2024.04')
	test.equal(p.xName, 'April 2024', 'point should be April 2024')
	test.equal(p.sampleCount, 1, 'sampleCount should be 1')
	test.equal(p.y, 7, 'count should be sum of values = 7')

	test.equal(series.median, 6, 'median with a single point should equal its 6 value')

	test.end()
})

tape('buildRunChartFromData() integer year values resolve to January', function (test) {
	const aggregation = 'mean'
	const xTermId = 'x'
	const yTermId = 'y'

	const inputData = {
		samples: {
			s1: {
				[xTermId]: { value: 2024 },
				[yTermId]: { value: 10 }
			},
			s2: {
				[xTermId]: { value: 2024 },
				[yTermId]: { value: 20 }
			},
			s3: {
				[xTermId]: { value: 2023 },
				[yTermId]: { value: 30 }
			}
		}
	}

	const expectedOutput = {
		status: 'ok',
		series: [
			{
				median: 22.5,
				points: [
					{
						x: 2023.01,
						xName: 'January 2023',
						y: 30,
						sampleCount: 1
					},
					{
						x: 2024.01,
						xName: 'January 2024',
						y: 15,
						sampleCount: 2
					}
				]
			}
		]
	}

	const output = buildRunChartFromData(aggregation, xTermId, yTermId, inputData)
	test.deepEqual(output, expectedOutput, 'integer year values should resolve to January of that year')

	test.end()
})
