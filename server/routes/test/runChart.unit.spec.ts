import tape from 'tape'
import { buildRunChartFromData } from '../runChart.helper.ts'

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- #routes/termdb.runChart -***-')
	test.end()
})

tape('buildRunChartFromData() mean aggregation', function (test) {
	const chartType = 'mean'
	const xTermId = 'x'
	const yTermId = 'y'

	const data = {
		samples: {
			s1: {
				[xTermId]: { value: '2024-01' },
				[yTermId]: { value: 10 }
			},
			s2: {
				[xTermId]: { value: '2024-01' },
				[yTermId]: { value: 20 }
			},
			s3: {
				[xTermId]: { value: '2024-02' },
				[yTermId]: { value: 30 }
			}
		}
	}

	const result = buildRunChartFromData(chartType, xTermId, yTermId, data)

	test.equal(result.status, 'ok', 'status should be ok')
	test.equal(result.series.length, 1, 'should return one series')

	const series = result.series[0]
	test.equal(series.points.length, 2, 'should have two monthly points')

	const jan = series.points[0]
	const feb = series.points[1]

	test.equal(jan.xName, 'January 2024', 'first point should be January 2024')
	test.equal(jan.y, 15, 'January mean should be (10 + 20) / 2 = 15')
	test.equal(jan.sampleCount, 2, 'January sampleCount should be 2')

	test.equal(feb.xName, 'February 2024', 'second point should be February 2024')
	test.equal(feb.y, 30, 'February mean should be 30')
	test.equal(feb.sampleCount, 1, 'February sampleCount should be 1')

	test.equal(series.median, 22.5, 'median of [15, 30] should be 22.5')

	test.end()
})

tape('buildRunChartFromData() proportion aggregation', function (test) {
	const chartType = 'proportion'
	const xTermId = 'x'
	const yTermId = 'y'

	const data = {
		samples: {
			s1: {
				[xTermId]: { value: '2024-03' },
				[yTermId]: { value: true }
			},
			s2: {
				[xTermId]: { value: '2024-03' },
				[yTermId]: { value: false }
			},
			s3: {
				[xTermId]: { value: '2024-03' },
				[yTermId]: { value: 1 }
			}
		}
	}

	const result = buildRunChartFromData(chartType, xTermId, yTermId, data)

	test.equal(result.status, 'ok', 'status should be ok')
	test.equal(result.series.length, 1, 'should return one series')

	const series = result.series[0]
	test.equal(series.points.length, 1, 'should have one monthly point')

	const p = series.points[0]
	test.equal(p.xName, 'March 2024', 'point should be March 2024')
	test.equal(p.sampleCount, 3, 'total should be 3')
	test.equal(p.y, 0.667, 'proportion should be 2 successes / 3 total, rounded to 3 decimals')

	test.equal(series.median, 0.667, 'median with a single point should equal its y value (0.667)')

	test.end()
})

tape('buildRunChartFromData() count aggregation', function (test) {
	const chartType = 'count'
	const xTermId = 'x'
	const yTermId = 'y'

	const data = {
		samples: {
			s1: {
				[xTermId]: { value: '2024-04' },
				[yTermId]: { value: 5 }
			},
			s2: {
				[xTermId]: { value: '2024-04' },
				[yTermId]: { value: 7 }
			}
		}
	}

	const result = buildRunChartFromData(chartType, xTermId, yTermId, data)

	test.equal(result.status, 'ok', 'status should be ok')
	test.equal(result.series.length, 1, 'should return one series')

	const series = result.series[0]
	test.equal(series.points.length, 1, 'should have one monthly point')

	const p = series.points[0]
	test.equal(p.xName, 'April 2024', 'point should be April 2024')
	test.equal(p.sampleCount, 2, 'sampleCount should be 2')
	test.equal(p.y, 12, 'count should be sum of values (5 + 7) = 12')

	test.equal(series.median, p.y, 'median with a single point should equal its y value')

	test.end()
})
