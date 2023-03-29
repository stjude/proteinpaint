export const sampleLstSql = {
	getCTE(tablename, tw, values) {
		let sql = '',
			samples,
			samplesString
		for (const [i, group] of tw.q.groups.entries()) {
			const name = Object.keys(tw.term.values)[i]
			samples = group.values.map(value => value.sampleId)
			samplesString = samples.map(() => '?').join(',')

			sql += `SELECT id as sample, ? as key, ? as value
				FROM sampleidmap
				WHERE sample ${group.in ? '' : 'NOT'} IN (${samplesString})
			`
			if (i != tw.q.groups.length - 1) sql += 'UNION ALL '

			values.push(name, name, ...samples)
		}
		return { sql: `${tablename} AS (${sql})`, tablename }
	}
}
