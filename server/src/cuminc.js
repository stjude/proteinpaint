const app = require('./app')

export function handle_incidence(genomes) {
	return async (req, res) => {
		app.log(req)
		console.log('handle_inc')
		const q = req.query
		try {
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome'
			const ds = genome.datasets[q.dslabel]
			if (!ds) throw 'invalid dslabel'
			if (!ds.cohort) throw 'ds.cohort missing'
			const tdb = ds.cohort.termdb
			if (!tdb) throw 'no termdb for this dataset'
			const data = get_sql_queries(q, ds)
			res.send(data)
		} catch (e) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
		}
	}
}

function get_sql_queries(q, ds) {
	const sql = `SELECT sample, MIN(age_graded), MIN(years_to_event) 
FROM chronicevents
WHERE grade >= ?
  AND term_id = ?
GROUP BY sample;`
	console.log('sql:', sql)
	return ds.cohort.db.connection.prepare(sql).all([q.grade, q.term_id])
}
