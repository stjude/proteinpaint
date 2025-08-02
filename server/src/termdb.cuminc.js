import { getData } from './termdb.matrix'
import { run_R } from '@sjcrh/proteinpaint-r'

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
		const twLst = []
		for (const i of [0, 1, 2]) {
			const termnum = 'term' + i
			const termnum_id = termnum + '_id'
			if (typeof q[termnum_id] == 'string') {
				q[termnum_id] = decodeURIComponent(q[termnum_id])
				q[termnum] = q.ds.cohort.termdb.q.termjsonByOneid(q[termnum_id])
			} else if (typeof q[termnum] == 'string') {
				q[termnum] = JSON.parse(decodeURIComponent(q[termnum]))
			}

			const termnum_q = termnum + '_q'
			const termnum_$id = termnum + '_$id'

			if (q[termnum] && !(termnum_$id in q)) {
				// $id of edited term is undefined and will not get
				// passed to backend
				// as a quick fix, fill $id with term id or name
				q[termnum_$id] = q[termnum].id || q[termnum].name
			}

			if (q[termnum]) twLst.push({ $id: q[termnum_$id], term: q[termnum], q: q[termnum_q] })
		}

		if (q.term1.type != 'condition') throw 'term1 must be condition term'
		if (q.term2?.type == 'condition') throw 'overlay term cannot be condition term'
		if (q.term0?.type == 'condition') throw 'divideBy term cannot be condition term'

		const data = await getData(
			{ terms: twLst, filter: q.filter, filter0: q.filter0, __protected__: q.__protected__ },
			ds,
			true
		) // FIXME hardcoded 3rd arg
		if (data.error) throw data.error

		const results = { data: {} }
		if (!Object.keys(data.samples).length) return results

		// parse data
		const byChartSeries = {}
		for (const d of Object.values(data.samples)) {
			if (twLst.map(tw => tw.$id).some(id => !Object.keys(d).includes(id))) continue // skip samples without data for all terms
			const chartId = q.term0 ? d[q.term0_$id].key : ''
			const time = d[q.term1_$id].value
			const event = d[q.term1_$id].key
			const series = q.term2 ? d[q.term2_$id].key : ''
			if (!(chartId in byChartSeries)) byChartSeries[chartId] = []
			byChartSeries[chartId].push({ time, event, series })
		}
		const bins = data.refs.byTermId[q.term2_$id]?.bins || []
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
	const ci_data = JSON.parse(await run_R('cuminc.R', JSON.stringify(Rinput)))

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
