const path = require('path')
const get_rows = require('./termdb.sql').get_rows
const spawn = require('child_process').spawn
const serverconfig = require('./serverconfig')
const do_plot = require('./km').do_plot

export async function get_survival(q, ds) {
	try {
		if (!ds.cohort) throw 'cohort missing from ds'
		q.ds = ds
		const results = get_rows(q)
		console.log(results.lst.slice(0, 5))
		const byChartSeries = {}
		for (const d of results.lst) {
			// do not include data when years_to_event < 0
			if (d.val1 < 0) continue
			// if no applicable term0 or term2, the d.key0/d.key2 is just a placeholder empty string,
			// see the comments in the get_rows() function for more details
			if (!(d.key0 in byChartSeries)) byChartSeries[d.key0] = {}
			if (!(d.key2 in byChartSeries[d.key0])) byChartSeries[d.key0][d.key2] = []
			byChartSeries[d.key0][d.key2].push({ name: d.key2, serialtime: Number(d.val1), censored: Number(d.key1) === 0 })
		}
		const bins = q.term2_id && results.CTE2.bins ? results.CTE2.bins : []
		const final_data = {
			keys: ['chartId', 'seriesId', 'time', 'survival', 'low', 'high'],
			case: [],
			refs: { bins }
		}
		const promises = []
		for (const chartId in byChartSeries) {
			for (const seriesId in byChartSeries[chartId]) {
				const data = byChartSeries[chartId][seriesId]
				if (!data.length) continue
				console.log(
					31,
					data.filter(d => d.censored === 0).length,
					data.filter(d => d.censored === 1).length,
					data.slice(-3)
				)
				//if (!data.filter(d => d.censored === 0).length) continue; console.log(35)
				const input = { name: data[0].key2, lst: data }
				do_plot(input)
				console.log(input.steps)
				for (const d of input.steps) {
					final_data.case.push([chartId, seriesId, d.x, 1 - d.y, 1 - d.y - 0.1, 1 - d.y + 0.1])
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
