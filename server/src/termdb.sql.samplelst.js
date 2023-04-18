export const sampleLstSql = {
	getCTE(tablename, tw, values) {
		let sql = '',
			samples,
			samplesString
		for (const [i, group] of tw.q.groups.entries()) {
			// default group.in=true, TODO: put this in fillTW?
			if (!('in' in group)) group.in = true
			samples = group.values.map(value => value.sampleId)
			samplesString = samples.map(() => '?').join(',')

			sql += `SELECT id as sample, ? as key, ? as value
				FROM sampleidmap
				WHERE sample ${group.in ? '' : 'NOT'} IN (${samplesString})
			`
			if (i != tw.q.groups.length - 1) sql += 'UNION ALL '

			values.push(group.name, group.name, ...samples)
		}
		return { sql: `${tablename} AS (${sql})`, tablename }
	}
}
