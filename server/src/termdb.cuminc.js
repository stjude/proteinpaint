const path = require('path')
const get_rows = require('./termdb.sql').get_rows
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
			promises.push(
				lines2R(path.join(serverconfig.binpath, 'utils/cuminc.R'), [JSON.stringify(data)]).then(Routput => {
					const ci_data = JSON.parse(Routput[0])
					// for single series, R will convert an empty string key to '1', so convert back to empty string
					if (Object.keys(ci_data.estimates).length == 1) {
						ci_data.estimates[''] = ci_data.estimates['1']
						delete ci_data.estimates['1']
					}
					//console.log('ci_data:', JSON.stringify(ci_data, null, 2))
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
					if (ci_data.tests) {
						if (!final_data.tests) final_data.tests = {}
						final_data.tests[chartId] = ci_data.tests
					}
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
