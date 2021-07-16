const path = require('path')
const get_rows = require('./termdb.sql').get_rows
const spawn = require('child_process').spawn
const serverconfig = require('./serverconfig')
const do_plot = require('./km').do_plot
const processSerieses = require('./survival.km').processSerieses
const lines2R = require('./utils').lines2R

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
		const tNum = q.term1_q && q.term1_q.type == 'survival' ? 't1' : 't2'
		const kNum = q.term1_q && q.term1_q.type == 'survival' ? 'key1' : 'key2'
		const vNum = q.term1_q && q.term1_q.type == 'survival' ? 'val1' : 'val2'
		const sNum = tNum == 't1' ? 'key2' : 'key1'

		const results = get_rows(q)
		results.lst.sort((a, b) => (a[vNum] < b[vNum] ? -1 : 1))
		const byChartSeries = {}
		for (const d of results.lst) {
			// do not include data when years_to_event < 0
			if (d[vNum] < 0) continue
			d.censored = d[kNum]
			if (q.km_method == 2) {
				if (!(d.key0 in byChartSeries)) byChartSeries[d.key0] = ['cohort\ttime\tstatus']
				const sKey = d[sNum]
				// negate the d.censored value (where 1 is censored) to transform to survfit() status value
				// since status=TRUE or 2 means 'dead' or 'event' in R's survival.survfit()
				byChartSeries[d.key0].push([d[sNum], d[vNum], d.censored == 0 ? 1 : 0].join('\t'))
			} else {
				// if no applicable term0, the d.key0 is just a placeholder empty string,
				// see the comments in the get_rows() function for more details
				if (!(d.key0 in byChartSeries)) byChartSeries[d.key0] = {}
				const sKey = d[sNum]
				if (!(sKey in byChartSeries[d.key0])) byChartSeries[d.key0][sKey] = []
				if (q.km_method == 1)
					byChartSeries[d.key0][sKey].push({
						id: d.sample,
						x: d[vNum],
						event: d.censored === 1 ? 'censored' : 'terminal'
					})
				// do_plot
				else
					byChartSeries[d.key0][sKey].push({
						name: d.sample,
						serialtime: Number(d[vNum]),
						censored: d.censored === 0 ? 1 : 0
					})
			}
		}
		const bins = q.term1_id && results.CTE1.bins ? results.CTE1.bins : []
		const final_data = {
			keys:
				q.km_method == 2
					? ['chartId', 'seriesId', 'time', 'survival', 'censored', 'lower', 'upper']
					: ['chartId', 'seriesId', 'time', 'survival', 'censored'],
			case: [],
			censored: [],
			refs: { bins }
		}
		const promises = []
		for (const chartId in byChartSeries) {
			if (q.km_method == 2) {
				const output = await lines2R('survival.R', byChartSeries[chartId])
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
							final_data.case.push([chartId, obj.cohort, obj.time, obj.surv, obj.ncensor, obj.lower, obj.upper])
						}
					})
			} else {
				let serieses = {} // may be used if q.km _method == 1
				for (const seriesId in byChartSeries[chartId]) {
					const data = byChartSeries[chartId][seriesId]
					//if (data.length < 5) continue
					if (q.km_method == 1) {
						serieses[seriesId] = data
						//console.log(data.map(d=>d.x).join(','));
						//console.log(data.map(d=>d.event=='terminal' ? 1 : 0).join(','))
					} else {
						const input = { name: data[0].key1, lst: data }
						do_plot(input)
						for (const d of input.steps) {
							final_data.case.push([chartId, seriesId, d.x, 1 - d.y, d.censored.length])
						}
					}
				}

				if (q.km_method == 1) {
					const results = processSerieses(serieses)
					for (const series of Object.values(results.data)) {
						//console.log(series.data.map(d=>d.x).join(','));
						//console.log(series.data.map(d=>d.y).join(','))
						//if (series.data.length < 5) continue;
						for (const d of series.data) {
							final_data.case.push([chartId, series.seriesId, d.x, d.y, 0])
						}
						series.censored.sort((a, b) => (a.x < b.x ? -1 : 1))
						for (const d of series.censored) {
							//console.log(series.seriesId, d.x, d.y)
							// combine censored with terminal data
							final_data.case.push([chartId, series.seriesId, d.x, d.y, 1])
						}
					}
				}
			}
		}
		// sort by d.x
		final_data.case.sort((a, b) => a[2] - b[2])
		return final_data
	} catch (e) {
		if (e.stack) console.log(e.stack)
		return { error: e.message || e }
	}
}
