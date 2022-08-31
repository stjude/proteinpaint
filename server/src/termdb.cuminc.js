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
			if (time < 0) continue
			if (!(chartId in byChartSeries)) byChartSeries[chartId] = []
			byChartSeries[chartId].push({ time, event, series })
		}
		const bins = q.term2_id && results.CTE2.bins ? results.CTE2.bins : []
		const final_data = {
			keys: ['chartId', 'seriesId', 'time', 'cuminc', 'low', 'high', 'nrisk', 'nevent', 'ncensor'],
			case: [],
			refs: { bins },
			startTimes: {}
		}

		// filter data prior to cumulative incidence analysis
		const fdata = {} // input for cuminc analysis {chartId: [{time, event, series}]}
		for (const chartId in byChartSeries) {
			if (!byChartSeries[chartId].length) continue

			// skip series that do not meet sample size threshold
			// compute sample sizes
			const samplesizes = new Map() // series => samplesize
			for (const sample of byChartSeries[chartId]) {
				let samplesize = samplesizes.get(sample.series)
				if (samplesize) {
					samplesize++
					samplesizes.set(sample.series, samplesize)
				} else {
					samplesizes.set(sample.series, 1)
				}
			}

			// flag series that do not meet the sample size threshold
			const toSkip = new Set()
			for (const [series, samplesize] of samplesizes) {
				if (samplesize < q.minSampleSize) {
					toSkip.add(series)
				}
			}

			// skip any flagged series
			if (toSkip.size > 0) {
				fdata[chartId] = byChartSeries[chartId].filter(sample => !toSkip.has(sample.series))
				// store the skipped series
				if (!final_data.skippedSeries) final_data.skippedSeries = {}
				final_data.skippedSeries[chartId] = [...toSkip]
				if (fdata[chartId].length === 0) {
					// all series in this chart have been skipped
					// therefore this chart will be skipped
					delete fdata[chartId]
					if (!final_data.skippedCharts) final_data.skippedCharts = []
					final_data.skippedCharts.push(chartId)
					continue
				}
			} else {
				// no series need to be skipped
				fdata[chartId] = byChartSeries[chartId]
			}
		}

		await runCumincR(fdata, final_data, minTimeSinceDx)
		return final_data
	} catch (e) {
		if (e.stack) console.log(e.stack)
		return { error: e.message || e }
	}
}

/* run cumulative incidence analysis in R
function has no returns; R analysis result are collected into "final_data{}"

fdata: {} see above
final_data: {
	.case[]
	.tests{}
	.startTimes{}
}
startTime: a number
	- custom first timepoint of curve.
	- may be defined if a dataset defines a minimum time cutoff (e.g. SJLIFE has a minimum time cutoff of 5 years since cancer diagnosis)
*/
export async function runCumincR(fdata, final_data, startTime = undefined) {
	// replace empty string chartIds and seriesIds with '*' for R (will reconvert later)
	for (let chartId in fdata) {
		if (chartId === '') {
			chartId = '*'
			fdata[chartId] = fdata['']
			delete fdata['']
		}
		fdata[chartId] = fdata[chartId].map(sample => {
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
	await write_file(datafile, JSON.stringify(fdata))
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
		// keep track of start times of curves
		final_data.startTimes[chartId] = {}
		// retrieve cumulative incidence estimates
		for (const seriesId in ci_data[chartId].estimates) {
			const series = ci_data[chartId].estimates[seriesId]
			// the first time point generated by cuminc() in R is always time 0
			// if startTime is defined, then use it on the client side for
			// rendering the first time point
			final_data.startTimes[chartId][seriesId] = { orig: series[0].time }
			if (startTime !== undefined) final_data.startTimes[chartId][seriesId].adj = startTime
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
