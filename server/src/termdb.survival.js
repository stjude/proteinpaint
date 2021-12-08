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
			}
			const termnum_q = termnum + '_q'
			if (q[termnum_q]) {
				q[termnum_q] = JSON.parse(decodeURIComponent(q[termnum_q]))
			}
		}

		// only term1 XOR term2 may be a survival term
		const tNum = q.term1_q && q.term1_q.type == 'survival' ? 't1' : 't2' // survival CTE table name
		const kNum = q.term1_q && q.term1_q.type == 'survival' ? 'key1' : 'key2' // seriesId = censored boolean
		const vNum = q.term1_q && q.term1_q.type == 'survival' ? 'val1' : 'val2' // time to event value
		const sNum = tNum == 't1' ? 'key2' : 'key1'

		const results = get_rows(q)
		results.lst.sort((a, b) => (a[vNum] < b[vNum] ? -1 : 1))
		const byChartSeries = {}
		const keys = { chart: new Set(), series: new Set() }
		for (const d of results.lst) {
			// do not include data when years_to_event < 0
			if (d[vNum] < 0) continue
			// clearer alias for censored boolean
			d.censored = d[kNum]
			if (!(d.key0 in byChartSeries)) {
				byChartSeries[d.key0] = ['cohort\ttime\tstatus']
				keys.chart.add(d.key0)
			}
			// R errors on an empty string cohort value,
			// so use '*' as a placeholder for now and will reconvert later
			const sKey = d[sNum] === '' ? '*' : d[sNum]
			keys.series.add(sKey)
			// negate the d.censored value (where 1 is censored) to transform to survfit() status value
			// since status=TRUE or 2 means 'dead' or 'event' in R's survival.survfit()
			byChartSeries[d.key0].push([sKey, d[vNum], d.censored == 0 ? 1 : 0].join('\t'))
		}
		const bins = q.term1_id && results.CTE1.bins ? results.CTE1.bins : []
		const final_data = {
			keys: ['chartId', 'seriesId', 'time', 'survival', 'censored', 'lower', 'upper'],
			case: [],
			censored: [],
			refs: { bins }
		}
		const promises = []
		for (const chartId in byChartSeries) {
			const output = await lines2R(path.join(serverconfig.binpath, 'utils/survival.R'), byChartSeries[chartId])
			let header
			output
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
						final_data.case.push([chartId, cohort, obj.time, obj.surv, obj.ncensor, obj.lower, obj.upper])
					}
				})
		}
		// sort by d.x
		final_data.case.sort((a, b) => a[2] - b[2])
		final_data.refs.orderedKeys = {
			chart: [...keys.chart].sort(),
			series: [...keys.series].sort()
		}
		return final_data
	} catch (e) {
		if (e.stack) console.log(e.stack)
		return { error: e.message || e }
	}
}
