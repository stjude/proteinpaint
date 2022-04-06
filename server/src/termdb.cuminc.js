const path = require('path')
const get_rows = require('./termdb.sql').get_rows
const write_file = require('./utils').write_file
const fs = require('fs')
const lines2R = require('./lines2R')
const serverconfig = require('./serverconfig')

export async function get_incidence(q, ds) {
	try {
		if (!ds.cohort) throw 'cohort missing from ds'
		q.ds = ds
		const results = get_rows(q)
		const byChartSeries = {}
		let minTime
		for (const d of results.lst) {
			// do not include data when years_to_event < 0
			if (d.val1 < 0) continue
			// if no applicable term0 or term2, the d.key0/d.key2 is just a placeholder empty string,
			// see the comments in the get_rows() function for more details
			if (!(d.key0 in byChartSeries)) byChartSeries[d.key0] = []
			byChartSeries[d.key0].push({ time: d.val1, event: d.key1, series: d.key2 })
			if (minTime === undefined || d.val1 < minTime) minTime = d.val1
		}
		const bins = q.term2_id && results.CTE2.bins ? results.CTE2.bins : []
		const final_data = {
			keys: ['chartId', 'seriesId', 'time', 'cuminc', 'low', 'high'],
			case: [],
			refs: { bins }
		}
		const promises = []
		for (const chartId in byChartSeries) {
			const data = byChartSeries[chartId]
			if (!data.length) continue
			const datafile = path.join(serverconfig.cachedir, Math.random().toString() + '.json')
			await write_file(datafile, JSON.stringify(data))
			promises.push(
				lines2R(path.join(serverconfig.binpath, 'utils/cuminc.R'), [], [datafile]).then(Routput => {
					const ci_data = JSON.parse(Routput[0])

					if (!ci_data.estimates) {
						// this chart has no cuminc estimates
						// because no events occurred in any
						// of the data serieses.
						// this chart will be skipped
						if (!final_data.skippedCharts) final_data.skippedCharts = []
						final_data.skippedCharts.push(chartId)
						return
					}

					// for chart with a single series, R will convert the series ID from '' to '1', so convert back to empty string
					const serieses = new Set(data.map(x => x.series))
					if (serieses.size == 1) {
						ci_data.estimates[''] = ci_data.estimates['1']
						delete ci_data.estimates['1']
					}

					// Cohort enrollment requires a minimum of 5 year survival after diagnosis,
					// the sql uses `AND years_to_event >= 5`, so reset the first data timepoint
					// to the actual queried minimum time. This first data point (case_est=0) is added
					// automatically by cuminc to its computed series data. 5 is the target x-axis min,
					// but check anyway to make sure that the constructed SQL result for min time
					// is used if lower than the expected 5 years_to_event.
					for (const seriesId in ci_data.estimates) {
						const series = ci_data.estimates[seriesId]
						series[0].time = Math.min(5, Math.floor(minTime))
						for (let i = 0; i < series.length; i++) {
							final_data.case.push([chartId, seriesId, series[i].time, series[i].est, series[i].low, series[i].up])
						}
					}

					// store results of statistical tests
					if (ci_data.tests) {
						if (!final_data.tests) final_data.tests = {}
						final_data.tests[chartId] = ci_data.tests
					}

					// store any skipped series
					if (ci_data.skippedSeries) {
						if (!final_data.skippedSeries) final_data.skippedSeries = {}
						final_data.skippedSeries[chartId] = ci_data.skippedSeries
					}

					// delete the input data file
					fs.unlink(datafile, () => {})
				})
			)
		}
		await Promise.all(promises)
		return final_data
	} catch (e) {
		if (e.stack) console.log(e.stack)
		return { error: e.message || e }
	}
}
