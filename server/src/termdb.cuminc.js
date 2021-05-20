const path = require('path')
const get_rows = require('./termdb.sql').get_rows
const spawn = require('child_process').spawn
const serverconfig = require('./serverconfig')

export async function get_incidence(q, ds) {
	try {
		if (!ds.cohort) throw 'cohort missing from ds'
		q.ds = ds
		const rows = get_rows(q, { withCTEs: true })
		const byChartSeries = {}
		for (const d of rows.lst) {
			if (!(d.key0 in byChartSeries)) byChartSeries[d.key0] = {}
			if (!(d.key2 in byChartSeries[d.key0])) byChartSeries[d.key0][d.key2] = []
			byChartSeries[d.key0][d.key2].push({ time: d.val1, event: d.key1 })
		}

		const final_data = {
			keys: ['chartId', 'seriesId', 'time', 'cuminc', 'low', 'high'],
			case: []
		}
		const promises = []
		for (const chartId in byChartSeries) {
			for (const seriesId in byChartSeries[chartId]) {
				const data = byChartSeries[chartId][seriesId]
				const year_to_events = data.map(d => +d.time).join('_')
				const events = data.map(d => +d.event).join('_')
				promises.push(
					calculate_cuminc(year_to_events, events).then(ci_data => {
						if (ci_data == null) {
							return { error: 'No output from R script' }
						} else if (!ci_data.case_time || !ci_data.case_time.length) {
							// do nothing
						} else {
							for (let i = 0; i < ci_data.case_time.length; i++) {
								final_data.case.push([
									chartId,
									seriesId,
									ci_data.case_time[i],
									ci_data.case_est[i],
									ci_data.low_case[i],
									ci_data.up_case[i]
								])
							}
						}
					})
				)
			}
		}
		await Promise.all(promises)
		return final_data
	} catch (e) {
		if (e.stack) console.log(e.stack)
		return { error: e.message || e }
	}
}

//function calculate_cuminc(year_to_events, events, groups) {
function calculate_cuminc(year_to_events, events, callback) {
	return new Promise((resolve, reject) => {
		const ps = spawn('Rscript', [path.join(serverconfig.binpath, './utils/cuminc.R'), year_to_events, events]) // Should we define Rscript in serverconfig.json?
		const out = [],
			out2 = []
		ps.stdout.on('data', d => out.push(d))
		ps.stderr.on('data', d => out2.push(d))
		ps.on('close', code => {
			/*const e = out2.join('').trim()
			if (e) {
				// got error running r script
				reject(e)
			}*/
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
