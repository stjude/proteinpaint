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
						x: 2020.62,
						xName: 'August 2020',
						y: 30,
						sampleCount: 1
					},
					{
						x: 2023.79,
						xName: 'October 2023',
						y: 15,
						sampleCount: 2
					}
				]
			}
		]
	}

	const output = buildRunChartFromData(aggregation, xTermId, yTermId, inputData, false)
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

	const result = buildRunChartFromData(aggregation, xTermId, yTermId, data, false)

	test.equal(result.status, 'ok', 'status should be ok')
	test.equal(result.series.length, 1, 'should return one series')

	const series = result.series[0]
	test.equal(series.points.length, 2, 'should have two monthly point')

	const p = series.points[0]
	test.equal(p.x, 2020.62, 'August x should be decimal-year at mid-month (2020.62)')
	test.equal(p.xName, 'August 2020', 'point should be August 2020')
	test.equal(p.sampleCount, 1, 'total should be 1')
	test.equal(p.y, 1, 'proportion should be 2 successes / 3 total, rounded to 3 decimals')

	test.equal(series.median, 10.5, 'median with a single point should equal its y value (10.5)')

	test.end()
})

tape('buildRunChartFromData() median aggregation', function (test) {
	const aggregation = 'median'
	const xTermId = 'x'
	const yTermId = 'y'

	const inputData = {
		samples: {
			s1: { [xTermId]: { value: 2023.83 }, [yTermId]: { value: 10 } },
			s2: { [xTermId]: { value: 2023.83 }, [yTermId]: { value: 20 } },
			s3: { [xTermId]: { value: 2023.83 }, [yTermId]: { value: 30 } }
		}
	}

	const result = buildRunChartFromData(aggregation, xTermId, yTermId, inputData, false)

	test.equal(result.status, 'ok', 'status should be ok')
	test.equal(result.series[0].points.length, 1, 'should have one monthly point')
	const p = result.series[0].points[0]
	test.equal(p.y, 20, 'median of [10,20,30] should be 20')
	test.equal(p.sampleCount, 3, 'sampleCount should be 3')
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

	const result = buildRunChartFromData(aggregation, xTermId, yTermId, data, false)

	test.equal(result.status, 'ok', 'status should be ok')
	test.equal(result.series.length, 1, 'should return one series')

	const series = result.series[0]
	test.equal(series.points.length, 2, 'should have two monthly point')

	const p = series.points[0]
	test.equal(p.x, 2024.29, 'April x should be decimal-year at mid-month (2024.29)')
	test.equal(p.xName, 'April 2024', 'point should be April 2024')
	test.equal(p.sampleCount, 1, 'sampleCount should be 1')
	test.equal(p.y, 7, 'count should be sum of values = 7')

	test.equal(series.median, 6, 'median with a single point should equal its 6 value')

	test.end()
})
