const path = require('path')
const get_rows = require('./termdb.sql').get_rows
const write_file = require('./utils').write_file
const fs = require('fs')
const lines2R = require('./lines2R')
const serverconfig = require('./serverconfig')

/*********** EXPORT
get_incidence()
runCumincR
*/

export async function get_incidence(q, ds) {
	try {
		if (!ds.cohort) throw 'cohort missing from ds'
		const minTimeSinceDx = ds.cohort.termdb.minTimeSinceDx
		if (!minTimeSinceDx) throw 'missing min time since dx'
		q.ds = ds
		const results = { data: {} }
		const rows = await get_rows(q)
		if (!rows.lst.length) return results

		// parse data rows
		const byChartSeries = {}
		for (const d of rows.lst) {
			// if no applicable term0 or term2, the d.key0/d.key2 is just a placeholder empty string (see comments in get_rows())
			const chartId = d.key0
			const time = d.val1
			const event = d.key1
			const series = d.key2
			if (!(chartId in byChartSeries)) byChartSeries[chartId] = []
			byChartSeries[chartId].push({ time, event, series })
		}
		const bins = q.term2_id && rows.CTE2.bins ? rows.CTE2.bins : []
		results.refs = { bins }

		// prepare R input
		const Rinput = { data: {}, startTime: minTimeSinceDx }
		// discard charts with no events of interest (event=1)
		// 	 - if there are only event=0, R will throw error
		// 	 - if there are only event=0/2, R will consider 2 to be
		// 	 event of interest
		// will report discarded charts to user
		for (const chartId in byChartSeries) {
			const chart = byChartSeries[chartId]
			if (!chart.find(x => x.event === 1)) {
				results.data[chartId] = {}
			} else {
				Rinput.data[chartId] = chart
			}
		}

		// run cumulative incidence analysis in R
		const ci_data = await runCumincR(Rinput)
		Object.assign(results.data, ci_data)

		return results
	} catch (e) {
		if (e.stack) console.log(e.stack)
		return { error: e.message || e }
	}
}

// run cumulative incidence analysis in R
export async function runCumincR(Rinput) {
	// replace empty string chartIds and seriesIds with '*' for R (will reconvert later)
	for (let chartId in Rinput.data) {
		if (chartId === '') {
			chartId = '*'
			Rinput.data[chartId] = Rinput.data['']
			delete Rinput.data['']
		}
		Rinput.data[chartId] = Rinput.data[chartId].map(sample => {
			const container = {
				time: sample.time,
				event: sample.event,
				series: sample.series === '' ? '*' : sample.series
			}
			return container
		})
	}

	// run cumulative incidence analysis
	const datafile = path.join(serverconfig.cachedir, Math.random().toString() + '.json')
	await write_file(datafile, JSON.stringify(Rinput))
	const Routput = await lines2R(path.join(serverconfig.binpath, 'utils/cuminc.R'), [], [datafile])
	const ci_data = JSON.parse(Routput[0])

	// parse cumulative incidence results
	// revert placeholders
	for (const chartId in ci_data) {
		if (chartId === '*') {
			ci_data[''] = ci_data[chartId]
			delete ci_data[chartId]
		}
	}
	for (const chartId in ci_data) {
		for (const seriesId in ci_data[chartId].estimates) {
			if (seriesId === '*') {
				ci_data[chartId].estimates[''] = ci_data[chartId].estimates[seriesId]
				delete ci_data[chartId].estimates[seriesId]
			}
		}
	}

	// delete the input data file
	fs.unlink(datafile, () => {})

	return ci_data
}
