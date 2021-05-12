const app = require('./app')

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
			const case_patient_ids = case_data.map(i => i.sample)
			const case_grades = case_data.map(i => i.grade).join('\t')
			const case_year_to_events = case_data.map(i => Object.values(i)[2]) // Was not able to call using the key name MIN(years_to_event), therefore using Object.values

			const control_data = get_sql_queries_lesser(q, ds)
			const control_patient_ids = control_data.map(i => i.sample)
			const control_grades = control_data.map(i => i.grade).join('\t')
			const control_year_to_events = control_data.map(i => Object.values(i)[2])

			const death_datas = get_sql_queries_greater(q, ds) // set grade = 5 for deaths
			//let patient_death_times = []
			//let patient_death_ids = []
			//if (death_datas.length != 0) { // Everybody is alive/censored
			//patient_death_status = data.map(i => '0').join('\t')
			//patient_death_times = data.map(i => 'NA').join('\t')
			const patient_death_ids = death_datas.map(i => i.sample)
			const patient_death_times = death_datas.map(i => Object.values(i)[2])
			//}
			let event_array = []
			for (let j = 0; j < case_patient_ids.length; j++) {
				let event = 1
				for (let i = 0; i < patient_death_ids.length; i++) {
					if (patient_death_ids[i] == case_patient_ids[j] && patient_death_times[i] <= case_year_to_events[j]) {
						event = 2
					}
				}
				event_array.push(event)
			}

			for (let j = 0; j < control_patient_ids.length; j++) {
				let event = 0
				for (let i = 0; i < patient_death_ids.length; i++) {
					if (patient_death_ids[i] == control_patient_ids[j] && patient_death_times[i] <= control_year_to_events[j]) {
						event = 2
					}
				}
				event_array.push(event)
			}
			const year_to_events = case_year_to_events.concat(control_year_to_events).join('\t')
			//console.log("year_to_events:",year_to_events)

			res.send(case_data)
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
