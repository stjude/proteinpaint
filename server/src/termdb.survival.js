const path = require('path')
const get_rows = require('./termdb.sql').get_rows
const spawn = require('child_process').spawn
const serverconfig = require('./serverconfig')
const do_plot = require('./km').do_plot
const processSerieses = require('./survival.km').processSerieses

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
		const vNum = q.term1_q && q.term1_q.type == 'survival' ? 'val1' : 'val2'
		const sNum = tNum == 't1' ? 'key2' : 'key1'

		const results = get_rows(q, {
			columnas: `t1.sample AS sample, ${tNum}.censored AS censored`
		})
		results.lst.sort((a, b) => (a[vNum] < b[vNum] ? -1 : 1))
		const byChartSeries = {}
		for (const d of results.lst) {
			// do not include data when years_to_event < 0
			if (d[vNum] < 0) continue
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
		const bins = q.term1_id && results.CTE1.bins ? results.CTE1.bins : []
		const final_data = {
			keys: ['chartId', 'seriesId', 'time', 'survival'],
			case: [],
			censored: [],
			refs: { bins }
		}
		const promises = []
		for (const chartId in byChartSeries) {
			let serieses = {} // may be used if q.km _method == 1
			for (const seriesId in byChartSeries[chartId]) {
				const data = byChartSeries[chartId][seriesId]
				if (data.length < 5) continue
				if (q.km_method == 1) {
					serieses[seriesId] = data
				} else {
					const input = { name: data[0].key1, lst: data }
					do_plot(input)
					for (const d of input.steps) {
						if (!d.censored.length) final_data.case.push([chartId, seriesId, d.x, 1 - d.y])
						else final_data.censored.push([chartId, seriesId, d.x, 1 - d.y])
					}
				}
			}
			if (q.km_method == 1) {
				const results = processSerieses(serieses)
				for (const series of Object.values(results.data)) {
					if (series.data.length < 5) continue
					for (const d of series.data) {
						final_data.case.push([chartId, series.seriesId, d.x, d.y])
					}
					series.censored.sort((a, b) => (a.x < b.x ? -1 : 1))
					for (const d of series.censored) {
						final_data.censored.push([chartId, series.seriesId, d.x, d.y])
					}
				}
			}
		}
		return final_data
	} catch (e) {
		if (e.stack) console.log(e.stack)
		return { error: e.message || e }
	}
}

function calculate_cuminc(year_to_events, events) {
	return new Promise((resolve, reject) => {
		const ps = spawn('Rscript', [path.join(serverconfig.binpath, './utils/cuminc.R'), year_to_events, events]) // Should we define Rscript in serverconfig.json?
		const out = [],
			out2 = []
		ps.stdout.on('data', d => out.push(d))
		ps.stderr.on('data', d => out2.push(d))
		ps.on('close', code => {
			const e = out2.join('').trim()
			if (e) {
				// got error running r script
				reject(e)
				return
			}
			const lines = out
				.join('')
				.trim()
				.split('\n')
			const ci_data = {}
			for (const line of lines) {
				if (line.includes('p_value')) {
					const line2 = line.split(':')
					ci_data.pvalue = Number.parseFloat(line2[1].replace('"', '').replace(' ', ''), 10)
				} else if (line.includes('control_time')) {
					const char_array = line.split(':')[1].split(',')
					ci_data.control_time = char_array.map(v => Number.parseFloat(v.replace(' ', ''), 10))
				} else if (line.includes('control_est')) {
					const char_array = line.split(':')[1].split(',')
					ci_data.control_est = char_array.map(v => Number.parseFloat(v.replace(' ', ''), 10))
				} else if (line.includes('case_time')) {
					const char_array = line.split(':')[1].split(',')
					ci_data.case_time = char_array.map(v => Number.parseFloat(v.replace(' ', ''), 10))
				} else if (line.includes('case_est')) {
					const char_array = line.split(':')[1].split(',')
					ci_data.case_est = char_array.map(v => Number.parseFloat(v.replace(' ', ''), 10))
				} else if (line.includes('low_control')) {
					const char_array = line.split(':')[1].split(',')
					ci_data.low_control = char_array.map(v => Number.parseFloat(v.replace(' ', ''), 10))
				} else if (line.includes('up_control')) {
					const char_array = line.split(':')[1].split(',')
					ci_data.up_control = char_array.map(v => Number.parseFloat(v.replace(' ', ''), 10))
				} else if (line.includes('low_case')) {
					const char_array = line.split(':')[1].split(',')
					ci_data.low_case = char_array.map(v => Number.parseFloat(v.replace(' ', ''), 10))
				} else if (line.includes('up_case')) {
					const char_array = line.split(':')[1].split(',')
					ci_data.up_case = char_array.map(v => Number.parseFloat(v.replace(' ', ''), 10))
				}
			}
			resolve(ci_data)
		})
	})
}
