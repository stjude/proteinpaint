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
			if (!(d.key0 in byChartSeries)) byChartSeries[d.key0] = {}
			if (!(d.key2 in byChartSeries[d.key0])) byChartSeries[d.key0][d.key2] = []
			byChartSeries[d.key0][d.key2].push({ time: d.val1, event: d.key1 })
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
			for (const seriesId in byChartSeries[chartId]) {
				const data = byChartSeries[chartId][seriesId]
				if (!data.length) continue
				// if there are no event=1, an error in the R script execution is issued (NAs in foreign function call (arg 3))
				if (!data.filter(d => d.event === 1).length) continue
				const Rinput = {
					times: data.map(d => d.time),
					events: data.map(d => d.event)
				}
				promises.push(
					lines2R(path.join(serverconfig.binpath, 'utils/cuminc.R'), [JSON.stringify(Rinput)]).then(Routput => {
						if (Routput.length != 1) throw 'R output is not one line in length'
						const ci_data = JSON.parse(Routput[0])
						// Cohort enrollment requires a minimum of 5 year survival after diagnosis,
						// the sql uses `AND years_to_event >= 5`, so reset the first data timepoint
						// to the actual queried minimum time. This first data point (case_est=0) is added
						// automatically by cuminc to its computed series data. 5 is the target x-axis min,
						// but check anyway to make sure that the constructed SQL result for min time
						// is used if lower than the expected 5 years_to_event.
						ci_data.time[0] = Math.min(5, Math.floor(minTime))
						for (let i = 0; i < ci_data.time.length; i++) {
							final_data.case.push([chartId, seriesId, ci_data.time[i], ci_data.est[i], ci_data.low[i], ci_data.up[i]])
						}
					})
				)
			}
		}
		await Promise.all(promises)
		return final_data
	} catch (e) {
		if (e.stack) console.log(e.stack)
		return { error: e.message || e }
	}
}
