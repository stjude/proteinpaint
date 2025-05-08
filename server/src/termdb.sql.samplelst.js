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
			samplesString = Array(samples.length).fill('?').join(',') //later on need to unify the list handling in samplelst
			sql += `SELECT id as sample, ? as key, ? as value
				FROM sampleidmap
				WHERE sample ${group.in ? '' : 'NOT'} IN (${samplesString})  `
			values.push(group.name, group.name)
			values.push(...samples)
			if (ds.cohort.db.tableColumns['sampleidmap'].includes('sample_type')) {
				sql += `and sample_type = ? `
				values.push(type)
			}

			if (i != tw.q.groups.length - 1) sql += 'UNION ALL '
		}
		return { sql: `${tablename} AS (${sql})`, tablename }
	}
}
