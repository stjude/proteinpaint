export const sampleLstSql = {
	getCTE(tablename, tw, values) {
		let sql = '',
			samples,
			samplesString
		for (const [i, group] of tw.q.groups.entries()) {
			samples = group.values
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
			if (i != tw.q.groups.length - 1) sql += 'UNION ALL '

			values.push(group.name, group.name, ...samples)
		}
		return { sql: `${tablename} AS (${sql})`, tablename }
	}
}
