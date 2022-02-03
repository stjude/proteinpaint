const path = require('path')
const get_rows = require('./termdb.sql').get_rows
const spawn = require('child_process').spawn
const serverconfig = require('./serverconfig')
const do_plot = require('./km').do_plot
const processSerieses = require('./survival.km').processSerieses
const lines2R = require('./lines2R')

export async function get_survival(q, ds) {
	try {
		if (!ds.cohort) throw 'cohort missing from ds'
		q.ds = ds
		for (const i of [0, 1, 2]) {
			const termnum = 'term' + i
			const termnum_id = termnum + '_id'
			if (q[termnum_id]) {
				q[termnum_id] = decodeURIComponent(q[termnum_id])
				q[termnum] = q.ds.cohort.termdb.q.termjsonByOneid(q[termnum_id])
			}
			const termnum_q = termnum + '_q'
			if (q[termnum_q]) {
				q[termnum_q] = JSON.parse(decodeURIComponent(q[termnum_q]))
			}
		}

		if (q.term2) {
			if (q.term2.type == 'survival' && q.term1.type == 'survival') {
				throw `term and overlay are both survival terms - only one could be a survival term`
			}
			if (q.term2.type != 'survival' && q.term1.type != 'survival') {
				throw `no survival terms, either the main term OR the overlay term must be a survival term`
			}
		} else if (q.term1.type != 'survival') {
			throw `non-survival term`
		}
		if (q.term0 && q.term0.type == 'survival') {
			throw `term0 must not be a survival term`
		}

		// only term1 XOR term2 may be a survival term
		const survTermIndex = q.term1 && q.term1.type == 'survival' ? 1 : 2
		const tNum = `t${survTermIndex}` // survival CTE table name
		const kNum = `key${survTermIndex}` // seriesId = censored boolean
		const vNum = `val${survTermIndex}` // time to event value
		const sNum = tNum == 't1' ? 'key2' : 'key1'
		const survq = tNum == 't1' ? q.term1_q : q.term2_q

		const results = get_rows(q, { withCTEs: true })
		results.lst.sort((a, b) => (a[vNum] < b[vNum] ? -1 : 1))

		const byChartSeries = {}
		const keys = { chart: new Set(), series: new Set() }
		for (const d of results.lst) {
			// do not include data when years_to_event < 0
			if (d[vNum] < 0) continue
			// clearer alias for censored boolean
			d.censored = d[kNum]
			if (!(d.key0 in byChartSeries)) {
				byChartSeries[d.key0] = [['cohort', 'time', 'status']]
				keys.chart.add(d.key0)
			}
			// R errors on an empty string cohort value,
			// so use '*' as a placeholder for now and will reconvert later
			const sKey = d[sNum] === '' ? '*' : d[sNum]
			keys.series.add(sKey)
			// negate the d.censored value (where 1 is censored) to transform to survfit() status value
			// since status=TRUE or 2 means 'dead' or 'event' in R's survival.survfit()
			byChartSeries[d.key0].push([sKey, d[vNum], d.censored == 0 ? 1 : 0])
		}
		const bins = q.term2_id && results.CTE2.bins ? results.CTE2.bins : []
		const final_data = {
			keys: ['chartId', 'seriesId', 'time', 'survival', 'lower', 'upper', 'nevent', 'ncensor', 'nrisk'],
			case: [],
			refs: { bins }
		}
		const promises = []
		for (const chartId in byChartSeries) {
			//console.log(byChartSeries[chartId])
			const output = await lines2R(
				path.join(serverconfig.binpath, 'utils/survival.R'),
				byChartSeries[chartId].map(d => d.join('\t'))
			)
			let header
			output
				// remove non-data artifacts from the stream, such as messages when a plot image file is saved in the R script
				.filter(line => line.includes('\t'))
				.map(line => line.split('\t'))
				.forEach((row, i) => {
					if (i === 0) header = row
					else {
						const obj = {}
						header.forEach((key, i) => {
							obj[key] = i > 0 ? Number(row[i]) : row[i]
						})
						// may reconvert a placeholder cohort value with an empty string
						const cohort = obj.cohort == '*' ? '' : obj.cohort
						final_data.case.push([
							chartId,
							cohort,
							obj.time,
							obj.surv,
							obj.lower,
							obj.upper,
							obj.nevent,
							obj.ncensor,
							obj.nrisk
						])
					}
				})
		}
		// sort by d.x
		final_data.case.sort((a, b) => a[2] - b[2])
		const orderedLabels = bins ? bins.map(bin => (bin.name ? bin.name : bin.label)) : null
		final_data.refs.orderedKeys = {
			chart: [...keys.chart].sort(),
			series: [...keys.series].sort(
				!orderedLabels ? undefined : (a, b) => orderedLabels.indexOf(a) - orderedLabels.indexOf(b)
			)
		}

		return final_data
	} catch (e) {
		if (e.stack) console.log(e.stack)
		return { error: e.message || e }
	}
}
