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
		const results = await get_rows(q)
		if (!results.lst.length) return { data: {} }
		const byChartSeries = {}
		for (const d of results.lst) {
			// if no applicable term0 or term2, the d.key0/d.key2 is just a placeholder empty string (see comments in get_rows())
			const chartId = d.key0
			const time = d.val1
			const event = d.key1
			const series = d.key2
			if (!(chartId in byChartSeries)) byChartSeries[chartId] = []
			byChartSeries[chartId].push({ time, event, series })
		}
		const bins = q.term2_id && results.CTE2.bins ? results.CTE2.bins : []

		const Rinput = {
			data: byChartSeries,
			startTime: minTimeSinceDx // start time of curve will be the min time since cancer diagnosis for the dataset
		}

		// run cumulative incidence analysis in R
		const ci_data = await runCumincR(Rinput)

		return { data: ci_data, refs: { bins } }
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
