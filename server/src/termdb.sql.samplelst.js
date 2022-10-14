export const sampleLstSql = {
	getCTE(tablename, term, q, values, filter) {
		const t2q = q.term2_q

		const samples = t2q.groups[0].values
		const samplesString = samples.map(() => '?').join(',')

		const sql = `SELECT id as sample, ? as key, ? as value
			FROM sampleidmap
			WHERE name IN (${samplesString})
			UNION ALL
			SELECT id as sample, ? as key, ? as value
			FROM sampleidmap
			WHERE name NOT IN (${samplesString})
		`

		values.push(t2q.groups[0].name, t2q.groups[0].name, ...samples, t2q.groups[1].name, t2q.groups[1].name, ...samples)
		return { sql: `${tablename} AS (${sql})`, tablename }
	}
}
