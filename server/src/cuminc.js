const app = require('./app')
const spawn = require('child_process').spawn
const readline = require('readline')

export function handle_incidence(genomes) {
	return async (req, res) => {
		app.log(req)
		const q = req.query
		try {
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome'
			const ds = genome.datasets[q.dslabel]
			if (!ds) throw 'invalid dslabel'
			if (!ds.cohort) throw 'ds.cohort missing'
			const tdb = ds.cohort.termdb
			if (!tdb) throw 'no termdb for this dataset'
			const case_data = get_sql_queries_greater(q, ds)
			//const case_patient_ids = case_data.map(i => i.sample)
			//const case_grades = case_data.map(i => i.grade).join('\t')
			const case_year_to_events = case_data.map(i => Object.values(i)[2])

			const control_data = get_sql_queries_lesser(q, ds)
			//const control_patient_ids = control_data.map(i => i.sample)
			//const control_grades = control_data.map(i => i.grade).join('\t')
			const control_year_to_events = control_data.map(i => Object.values(i)[2])

			const death_datas = get_sql_queries_death(q, ds) // set grade = 5 for deaths
			const patient_death_ids = death_datas.map(i => i.sample)
			const patient_death_times = death_datas.map(i => Object.values(i)[2])

			let event_array = []
			let group_array = []
			for (let j = 0; j < case_data.length; j++) {
				const case_year_to_event = Object.values(case_data[j])[2] // Was not able to call using the key name MIN(years_to_event), therefore using Object.values
				let event = 0
				let group = 1
				if (case_data[j].grade != 0) {
					event = 1
				}
				for (let i = 0; i < death_datas.length; i++) {
					const patient_death_time = Object.values(death_datas[i])[2]
					if (death_datas[i].sample == case_data[j].sample && patient_death_time <= case_year_to_event) {
						console.log('death_datas[i].sample:', death_datas[i].sample)
						event = 2
					}
				}
				event_array.push(event)
				group_array.push(group)
			}

			for (let j = 0; j < control_data.length; j++) {
				const control_year_to_event = Object.values(control_data[j])[2]
				let event = 0
				let group = 0
				if (control_data[j].grade != 0) {
					event = 1
				}
				for (let i = 0; i < death_datas.length; i++) {
					const patient_death_time = Object.values(death_datas[i])[2]
					if (death_datas[i].sample == control_data[j].sample && patient_death_time <= control_year_to_event) {
						event = 2
					}
				}
				event_array.push(event)
				group_array.push(group)
			}
			const year_to_events = case_year_to_events.concat(control_year_to_events).join('_')
			const events = event_array.join('_')
			const groups = group_array.join('_')
			//console.log('year_to_events:', year_to_events)
			//console.log('events:', events)
			//console.log('groups:', groups)

			const ci_data = await calculate_cuminc(year_to_events, events, groups)
			//console.log('ci_data:', ci_data)
			const control_array = []
			for (let i = 0; i < ci_data.control_time.length; i++) {
				control_array.push([
					ci_data.control_time[i],
					ci_data.control_est[i],
					ci_data.low_control[i],
					ci_data.up_control[i]
				])
			}

			const case_array = []
			for (let i = 0; i < ci_data.case_time.length; i++) {
				case_array.push([ci_data.case_time[i], ci_data.case_est[i], ci_data.low_case[i], ci_data.up_case[i]])
			}
			const final_data = {}
			final_data.pvalue = ci_data.pvalue
			final_data.keys = ['time', 'cuminc', 'low', 'high']
			final_data.control = control_array
			final_data.case = case_array

			res.send(final_data)
		} catch (e) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
		}
	}
}

function get_sql_queries_greater(q, ds) {
	const sql = `SELECT sample, grade, MIN(years_to_event) 
FROM chronicevents
WHERE grade >= ?
  AND grade < 5
  AND term_id = ?
GROUP BY sample;`
	return ds.cohort.db.connection.prepare(sql).all([q.grade, q.term_id])
}

function get_sql_queries_death(q, ds) {
	const sql = `SELECT sample, grade, MIN(years_to_event) 
FROM chronicevents
WHERE grade = 5
  AND term_id = ?
GROUP BY sample;`
	return ds.cohort.db.connection.prepare(sql).all([q.term_id])
}

function get_sql_queries_lesser(q, ds) {
	const sql = `SELECT sample, grade, MIN(years_to_event) 
FROM chronicevents
WHERE grade < ?
  AND term_id = ?
GROUP BY sample;`
	return ds.cohort.db.connection.prepare(sql).all([q.grade, q.term_id])
}

function calculate_cuminc(year_to_events, events, groups) {
	const ci_data = {}
	return new Promise((resolve, reject) => {
		const ps = spawn('Rscript', ['server/src/cuminc.R', year_to_events, events, groups]) // Should we define Rscript in serverconfig.json?
		const rl = readline.createInterface({ input: ps.stdout })

		rl.on('line', line => {
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
