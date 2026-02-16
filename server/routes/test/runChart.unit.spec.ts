import tape from 'tape'
import { buildRunChartFromData, buildFrequencyFromData } from '../termdb.runChart.ts'

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- #routes/termdb.runChart -***-')
	test.end()
})

tape('buildRunChartFromData() median aggregation (multi-month)', function (test) {
	const aggregation = 'median'
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
	test.equal(series.points.length, 3, 'should have three monthly points (including one with null Y)')

	const p = series.points[0]
	test.equal(p.x, 2020.62, 'August x should be decimal-year at mid-month (2020.62)')
	test.equal(p.xName, 'August 2020', 'point should be August 2020')
	test.equal(p.sampleCount, 1, 'total should be 1')
	test.equal(p.y, 1, 'proportion should be 2 successes / 3 total, rounded to 3 decimals')

	// Median is calculated from all y values in points (including the 0 from null Y bucket)
	// y values are: [1, 0, 20] → sorted: [0, 1, 20] → median = 1
	test.equal(series.median, 1, 'median of proportion values [0, 1, 20] should be 1')

	test.end()
})

tape('buildRunChartFromData() median aggregation', function (test) {
	const aggregation = 'median'
	const xTermId = 'x'
	const yTermId = 'y'

	const inputData = {
		samples: {
			s1: { [xTermId]: { value: 2023.83 }, [yTermId]: { value: 1 } },
			s2: { [xTermId]: { value: 2023.83 }, [yTermId]: { value: 2 } },
			s3: { [xTermId]: { value: 2023.83 }, [yTermId]: { value: 100 } }
		}
	}

	const result = buildRunChartFromData(aggregation, xTermId, yTermId, inputData, false)

	test.equal(result.status, 'ok', 'status should be ok')
	test.equal(result.series[0].points.length, 1, 'should have one monthly point')
	const p = result.series[0].points[0]
	test.equal(p.y, 2, 'median of [1,2,100] should be 2')
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

tape('buildRunChartFromData() year-only dates (no decimal)', function (test) {
	const aggregation = 'median'
	const xTermId = 'x'
	const yTermId = 'y'

	const data = {
		samples: {
			s1: { [xTermId]: { value: 2020 }, [yTermId]: { value: 100 } },
			s2: { [xTermId]: { value: 2021 }, [yTermId]: { value: 200 } }
		}
	}

	const result = buildRunChartFromData(aggregation, xTermId, yTermId, data, false)

	test.equal(result.status, 'ok', 'status should be ok')
	test.equal(result.series.length, 1, 'should return one series')
	test.equal(result.series[0].points.length, 2, 'should have two points for two years')

	const p1 = result.series[0].points[0]
	test.equal(p1.xName, 'January 2020', 'year-only 2020 should default to January 2020')
	test.equal(p1.y, 100, 'should have correct y value')

	const p2 = result.series[0].points[1]
	test.equal(p2.xName, 'January 2021', 'year-only 2021 should default to January 2021')
	test.equal(p2.y, 200, 'should have correct y value')

	test.end()
})

tape('buildRunChartFromData() missing Y values with median aggregation', function (test) {
	const aggregation = 'median'
	const xTermId = 'x'
	const yTermId = 'y'

	const data = {
		samples: {
			s1: { [xTermId]: { value: 2023.5 }, [yTermId]: { value: 1 } },
			s2: { [xTermId]: { value: 2023.5 }, [yTermId]: { value: 2 } },
			s3: { [xTermId]: { value: 2023.5 }, [yTermId]: { value: 100 } },
			s4: { [xTermId]: { value: 2023.5 }, [yTermId]: { value: null } },
			s5: { [xTermId]: { value: 2023.5 }, [yTermId]: { value: null } }
		}
	}

	const result = buildRunChartFromData(aggregation, xTermId, yTermId, data, false)

	test.equal(result.status, 'ok', 'status should be ok')
	const point = result.series[0].points[0]
	test.equal(point.y, 2, 'median of [1, 2, 100] should be 2 (not mean ~34.33)')
	test.equal(point.sampleCount, 3, 'sampleCount should only count valid Y values for median aggregation')

	test.end()
})

tape('buildRunChartFromData() all missing Y values for a time bucket', function (test) {
	const aggregation = 'median'
	const xTermId = 'x'
	const yTermId = 'y'

	const data = {
		samples: {
			s1: { [xTermId]: { value: 2023.5 }, [yTermId]: { value: null } },
			s2: { [xTermId]: { value: 2023.5 }, [yTermId]: { value: null } }
		}
	}

	const result = buildRunChartFromData(aggregation, xTermId, yTermId, data, false)

	test.equal(result.status, 'ok', 'status should be ok')
	const point = result.series[0].points[0]
	test.equal(point.y, 0, 'y should be 0 when all values are null')
	test.equal(point.sampleCount, 2, 'sampleCount should still count samples with null Y values')

	test.end()
})

tape('buildRunChartFromData() period partitioning (shouldPartition=true)', function (test) {
	const aggregation = 'median'
	const xTermId = 'x'
	const yTermId = 'y'

	const data = {
		samples: {
			s1: { [xTermId]: { key: '2020', value: 2020.5 }, [yTermId]: { value: 10 } },
			s2: { [xTermId]: { key: '2020', value: 2020.7 }, [yTermId]: { value: 20 } },
			s3: { [xTermId]: { key: '2021', value: 2021.5 }, [yTermId]: { value: 30 } },
			s4: { [xTermId]: { key: '2021', value: 2021.8 }, [yTermId]: { value: 40 } }
		}
	}

	const result = buildRunChartFromData(aggregation, xTermId, yTermId, data, true, xTermId)

	test.equal(result.status, 'ok', 'status should be ok')
	test.equal(result.series.length, 2, 'should return two series (one per period)')

	const series2020 = result.series.find(s => s.seriesId === '2020')
	const series2021 = result.series.find(s => s.seriesId === '2021')

	test.ok(series2020, 'should have 2020 series')
	test.ok(series2021, 'should have 2021 series')

	test.equal(series2020!.points.length, 2, '2020 series should have 2 points')
	test.equal(series2021!.points.length, 2, '2021 series should have 2 points')

	test.equal(series2020!.median, 15, '2020 median should be (10+20)/2 = 15')
	test.equal(series2021!.median, 35, '2021 median should be (30+40)/2 = 35')

	test.end()
})

tape('buildRunChartFromData() unsupported aggregation method throws error', function (test) {
	const aggregation = 'mean'
	const xTermId = 'x'
	const yTermId = 'y'

	const inputData = {
		samples: {
			s1: {
				[xTermId]: { value: 2023.8 },
				[yTermId]: { value: 10 }
			}
		}
	}

	test.throws(
		() => {
			buildRunChartFromData(aggregation, xTermId, yTermId, inputData, false)
		},
		/Unsupported aggregation method: mean/,
		'should throw error for unsupported aggregation method'
	)

	test.end()
})

tape('buildFrequencyFromData() showCumulativeFrequency returns cumulative y and server median', function (test) {
	const xTermId = 'date'
	const data = {
		samples: {
			s1: { [xTermId]: { value: 2024.01 } },
			s2: { [xTermId]: { value: 2024.01 } },
			s3: { [xTermId]: { value: 2024.29 } },
			s4: { [xTermId]: { value: 2024.54 } }
		}
	}

	const result = buildFrequencyFromData(xTermId, data, false, undefined, true)

	test.equal(result.status, 'ok', 'status should be ok')
	test.equal(result.series.length, 1, 'should return one series')
	const points = result.series[0].points
	test.equal(points.length, 3, 'should have three monthly buckets')
	test.equal(points[0].y, 2, 'first bucket cumulative count 2')
	test.equal(points[1].y, 3, 'second bucket cumulative count 3')
	test.equal(points[2].y, 4, 'third bucket cumulative count 4')
	test.equal(points[0].sampleCount, 2, 'sampleCount should match cumulative y')
	test.equal(result.series[0].median, 3, 'median of cumulative values [2, 3, 4] should be 3')
	test.end()
})
