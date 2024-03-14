import path from 'path'
import { get_rows } from './termdb.sql'
import { write_file } from './utils'
import fs from 'fs'
import run_R from './run_R'
import serverconfig from './serverconfig'

/*********** EXPORT
get_incidence()
runCumincR
*/

export async function get_incidence(q, ds) {
	try {
		if (!ds.cohort) throw 'cohort missing from ds'
		const minTimeSinceDx = ds.cohort.termdb.minTimeSinceDx
		const minSampleSize = Number(q.minSampleSize)
		if (!Number.isFinite(minTimeSinceDx)) throw 'invalid minTimeSinceDx'
		if (!Number.isFinite(minSampleSize)) throw 'invalid minSampleSize'
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
		results.noEvents = {}
		results.lowSampleSize = {}
		for (const chartId in byChartSeries) {
			const chart = byChartSeries[chartId]
			const seriesIds = new Set(chart.map(x => x.series))
			for (const seriesId of seriesIds) {
				const series = chart.filter(sample => sample.series == seriesId)
				if (!series.find(sample => sample.event === 1)) {
					// skip series with no events of interest (i.e. event=1)
					// need to do this because if series only has event=0/2
					// then R will consider event=2 to be event of interest
					results.noEvents[chartId] = (results.noEvents[chartId] || []).concat([seriesId])
					continue
				}
				if (series.length < minSampleSize) {
					// skip series with low sample size
					// should do this because cuminc computation of series
					// with low sample size can trigger permutation tests
					// which have long execution times
					results.lowSampleSize[chartId] = (results.lowSampleSize[chartId] || []).concat([seriesId])
					continue
				}
				Rinput.data[chartId] = (Rinput.data[chartId] || []).concat(series)
			}
			if (!(chartId in Rinput.data)) results.data[chartId] = {}
		}
		if (!Object.keys(Rinput.data).length) return { data: {} }

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
	const ci_data = JSON.parse(await run_R(path.join(serverconfig.binpath, 'utils', 'cuminc.R'), JSON.stringify(Rinput)))

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

	return ci_data
}
