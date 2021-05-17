const app = require('./app')
const path = require('path')
const getFilterCTEs = require('./termdb.filter').getFilterCTEs
const spawn = require('child_process').spawn
const serverconfig = require('./serverconfig')
const readline = require('readline')

export function handle_incidence(genomes) {
	return async (req, res) => {
		app.log(req)
		const q = req.query
		if (q.filter) {
			q.filter = JSON.parse(decodeURIComponent(q.filter))
		}
		try {
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome'
			const ds = genome.datasets[q.dslabel]
			if (!ds) throw 'invalid dslabel'
			if (!ds.cohort) throw 'ds.cohort missing'
			const tdb = ds.cohort.termdb
			if (!tdb) throw 'no termdb for this dataset'

			const filter = getFilterCTEs(q.filter, q.ds)
			const data = get_sql_query(q, ds, filter)
			const year_to_events = data.map(d => d.time).join('_')
			const events = data.map(d => d.event).join('_')
			const ci_data = await calculate_cuminc(year_to_events, events)
			//console.log('ci_data:', ci_data)
			const final_data = {}
			if (ci_data == null) {
				console.log('No output from R script')
			} else {
				const case_array = []
				for (let i = 0; i < ci_data.case_time.length; i++) {
					case_array.push([ci_data.case_time[i], ci_data.case_est[i], ci_data.low_case[i], ci_data.up_case[i]])
				}
				final_data.keys = ['time', 'cuminc', 'low', 'high']
				final_data.case = case_array
			}
			res.send(final_data)
		} catch (e) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
		}
	}
}

function get_sql_query(q, ds, filter) {
	const values = filter ? filter.values.slice() : []
	values.push(...[q.grade, q.term_id])

	const sql = `WITH
${filter ? filter.filters + ',' : ''}
event1 AS (
	SELECT sample, MIN(years_to_event) as time, 1 as event
	FROM chronicevents
	WHERE grade >= ?
	  AND grade <= 5
	  AND term_id = ?
	  ${filter ? 'AND sample IN ' + filter.CTEname : ''}
	GROUP BY sample
),
event1samples AS (
	SELECT sample
	FROM event1
),
event0 AS (
	SELECT sample, MAX(years_to_event) as time, 0 as event
	FROM chronicevents
	WHERE grade <= 5 
		AND sample NOT IN event1samples
	  ${filter ? 'AND sample IN ' + filter.CTEname : ''}
	GROUP BY sample
)
SELECT * FROM event1
UNION ALL
SELECT * FROM event0
`
	return ds.cohort.db.connection.prepare(sql).all(values)
}

//function calculate_cuminc(year_to_events, events, groups) {
function calculate_cuminc(year_to_events, events) {
	const ci_data = {}
	return new Promise((resolve, reject) => {
		//const ps = spawn('Rscript', ['server/src/cuminc.R', year_to_events, events, groups]) // Should we define Rscript in serverconfig.json?
		const ps = spawn('Rscript', [path.join(serverconfig.binpath, './server/src/cuminc.R'), year_to_events, events]) // Should we define Rscript in serverconfig.json?
		const rl = readline.createInterface({ input: ps.stdout })

		rl.on('line', line => {
			//console.log("R_line:",line)
			if (line.includes('p_value') == true) {
				const line2 = line.split(':')
				ci_data.pvalue = parseFloat(line2[1].replace('"', '').replace(' ', ''), 10)
			} else if (line.includes('control_time') == true) {
				const char_array = line.split(':')[1].split(',')
				ci_data.control_time = char_array.map(v => parseFloat(v.replace(' ', ''), 10))
			} else if (line.includes('control_est') == true) {
				const char_array = line.split(':')[1].split(',')
				ci_data.control_est = char_array.map(v => parseFloat(v.replace(' ', ''), 10))
			} else if (line.includes('case_time') == true) {
				const char_array = line.split(':')[1].split(',')
				ci_data.case_time = char_array.map(v => parseFloat(v.replace(' ', ''), 10))
			} else if (line.includes('case_est') == true) {
				const char_array = line.split(':')[1].split(',')
				ci_data.case_est = char_array.map(v => parseFloat(v.replace(' ', ''), 10))
			} else if (line.includes('low_control') == true) {
				const char_array = line.split(':')[1].split(',')
				ci_data.low_control = char_array.map(v => parseFloat(v.replace(' ', ''), 10))
			} else if (line.includes('up_control') == true) {
				const char_array = line.split(':')[1].split(',')
				ci_data.up_control = char_array.map(v => parseFloat(v.replace(' ', ''), 10))
			} else if (line.includes('low_case') == true) {
				const char_array = line.split(':')[1].split(',')
				ci_data.low_case = char_array.map(v => parseFloat(v.replace(' ', ''), 10))
			} else if (line.includes('up_case') == true) {
				const char_array = line.split(':')[1].split(',')
				ci_data.up_case = char_array.map(v => parseFloat(v.replace(' ', ''), 10))
			}
		})
		rl.on('close', () => {
			resolve(ci_data)
		})
	})
}
