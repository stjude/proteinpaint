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
		if (minTimeSinceDx === undefined) throw 'missing min time since dx'
		q.ds = ds
		const results = get_rows(q)
		const byChartSeries = {}
		for (const d of results.lst) {
			// if no applicable term0 or term2, the d.key0/d.key2 is just a placeholder empty string (see comments in get_rows())
			const chartId = d.key0
			const time = d.val1
			const event = d.key1
			const series = d.key2
			// do not include data when years_to_event < 0
			if (time < 0) continue //TODO: this should be handled in sql
			if (!(chartId in byChartSeries)) byChartSeries[chartId] = []
			byChartSeries[chartId].push({ time, event, series })
		}
		const bins = q.term2_id && results.CTE2.bins ? results.CTE2.bins : []
		const final_data = {
			keys: ['chartId', 'seriesId', 'time', 'cuminc', 'low', 'high', 'nrisk', 'nevent', 'ncensor'],
			case: [],
			refs: { bins }
		}

		/*
		prepare R input

		input format
		{
			data: { chartId: [{time, event, series}] },
			startTime: number, custom start time of cuminc curve
		}
		*/

		const Rinput = {
			data: {},
			startTime: minTimeSinceDx // start time of curve will be the min time since cancer diagnosis for the dataset
		}

		for (const chartId in byChartSeries) {
			/*
			filter series of chart
			
			skip series that do not meet sample size or event count thresholds
			sample size threshold is specified by user
			event count threshold is 0, because R will throw error when no series has an event
			*/

			// compute sample sizes and event counts for each series
			const series2counts = new Map() // series => {samplesize, eventcnt}
			for (const sample of byChartSeries[chartId]) {
				let counts = series2counts.get(sample.series)
				if (counts) {
					counts.samplesize++
					if (sample.event == 1) counts.eventcnt++
					series2counts.set(sample.series, counts)
				} else {
					counts = {
						samplesize: 1,
						eventcnt: sample.event == 1 ? 1 : 0
					}
					series2counts.set(sample.series, counts)
				}
			}

			// flag series that do not meet the sample size or event count thresholds
			const lowSampleSize = new Set()
			const lowEventCnt = new Set()
			for (const [series, counts] of series2counts) {
				if (counts.samplesize < q.minSampleSize) {
					lowSampleSize.add(series)
				}
				if (counts.eventcnt === 0) {
					lowEventCnt.add(series)
				}
			}

			// keep track of any flagged series
			if (lowSampleSize.size) {
				if (!final_data.lowSampleSize) final_data.lowSampleSize = {}
				final_data.lowSampleSize[chartId] = [...lowSampleSize]
			}
			if (lowEventCnt.size) {
				if (!final_data.lowEventCnt) final_data.lowEventCnt = {}
				final_data.lowEventCnt[chartId] = [...lowEventCnt]
			}

			// skip any flagged series
			const samples = byChartSeries[chartId].filter(
				sample => !lowSampleSize.has(sample.series) && !lowEventCnt.has(sample.series)
			)
			if (samples) {
				Rinput.data[chartId] = samples
			} else {
				// skip the chart if all series have been skipped
				// keep track of any skipped charts
				if (!final_data.skippedCharts) final_data.skippedCharts = []
				final_data.skippedCharts.push(chartId)
			}
		}

		// run cumulative incidence analysis in R
		await runCumincR(Rinput, final_data)

		return final_data
	} catch (e) {
		if (e.stack) console.log(e.stack)
		return { error: e.message || e }
	}
}

/*
run cumulative incidence analysis in R

function has no returns

R analysis results are collected into "final_data{}"

Rinput: {} see above
final_data: {
	.case[]
	.tests{}
}
*/
export async function runCumincR(Rinput, final_data) {
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
	// first revert placeholders
	if (Object.keys(ci_data).length == 1) {
		if (Object.keys(ci_data)[0] === '*') {
			ci_data[''] = ci_data['*']
			delete ci_data['*']
		} else {
			throw 'unexpected chartId'
		}
	}
	for (const chartId in ci_data) {
		if (Object.keys(ci_data[chartId].estimates).length == 1) {
			if (Object.keys(ci_data[chartId].estimates)[0] === '*') {
				ci_data[chartId].estimates[''] = ci_data[chartId].estimates['*']
				delete ci_data[chartId].estimates['*']
			} else {
				throw 'unexpected seriesId'
			}
		}
	}

	// parse results
	for (const chartId in ci_data) {
		// retrieve cumulative incidence estimates
		for (const seriesId in ci_data[chartId].estimates) {
			const series = ci_data[chartId].estimates[seriesId]
			// fill in final_data.case[]
			for (let i = 0; i < series.length; i++) {
				final_data.case.push([
					chartId,
					seriesId,
					series[i].time,
					series[i].est,
					series[i].low,
					series[i].up,
					series[i].nrisk,
					series[i].nevent,
					series[i].ncensor
				])
			}
		}
		// retrieve results of Gray's tests
		if (ci_data[chartId].tests) {
			if (!final_data.tests) final_data.tests = {}
			final_data.tests[chartId] = ci_data[chartId].tests
		}
	}

	// delete the input data file
	fs.unlink(datafile, () => {})
}
