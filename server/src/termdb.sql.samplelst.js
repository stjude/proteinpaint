export const sampleLstSql = {
	getCTE(tablename, term, q, values, filter) {
		const t2q = q.term2_q || q.terms?.[1].q
		let sql = '',
			samples,
			samplesString
		for (const [i, group] of t2q.groups.entries()) {
			samples = group.values
			console.log(10, samples)
			samplesString = samples.map(() => '?').join(',')
			if (i == 1 && group.name == 'Others') {
				sql += `
				SELECT id as sample, ? as key, ? as value
				FROM sampleidmap
				WHERE name NOT IN (${samplesString})`
				values.push(group.name, group.name, ...samples)
				break
			}

			sql += `SELECT id as sample, ? as key, ? as value
				FROM sampleidmap
				WHERE name IN (${samplesString})
			`
			if (i != t2q.groups.length - 1) sql += 'UNION ALL '

			values.push(group.name, group.name, ...samples)
		}
		// console.log(28, sql, values)
		return { sql: `${tablename} AS (${sql})`, tablename }
	}
}
