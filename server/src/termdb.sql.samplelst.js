export const sampleLstSql = {
	getCTE(ds, tablename, tw, values) {
		let sql = '',
			samples,
			samplesString
		for (const [i, group] of tw.q.groups.entries()) {
			// default group.in=true, TODO: put this in fillTW?
			if (!('in' in group)) group.in = true
			samples = group.values.map(value => value.sampleId || value.sample)
			const type = samples[0] ? ds.sampleId2Type.get(samples[0]) : ''
			samplesString = samples.join(',') //later on need to unify the list handling in samplelst

			sql += `SELECT id as sample, ? as key, ? as value
				FROM sampleidmap
				WHERE sample ${group.in ? '' : 'NOT'} IN (${samplesString})  `
			if (ds.cohort.db.tableColumns['sampleidmap'].includes('sample_type')) sql += `and sample_type = ${type} `

			if (i != tw.q.groups.length - 1) sql += 'UNION ALL '
			values.push(group.name, group.name)
		}
		console.log('sampleLstSql.getCTE', sql)
		return { sql: `${tablename} AS (${sql})`, tablename }
	}
}
