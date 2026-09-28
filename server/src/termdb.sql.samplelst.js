import { sql } from './sql.ts'

export const sampleLstSql = {
	getCTE(ds, tablename, tw) {
		const hasSampleType = ds.cohort.db.tableColumns['sampleidmap'].includes('sample_type')
		const selects = tw.q.groups.map(group => {
			// default group.in=true, TODO: put this in fillTW?
			if (!('in' in group)) group.in = true
			const samples = group.values.map(value => value.sampleId || value.sample)
			const type = samples[0] ? ds.sampleId2Type.get(samples[0]) : ''
			return sql`SELECT id as sample, ${group.name} as key, ${group.name} as value
				FROM sampleidmap
				WHERE sample ${group.in ? sql`` : sql`NOT`} IN (${sql.list(samples, { allowEmpty: true })})  
				${hasSampleType ? sql`and sample_type = ${type}` : sql``}`
		})
		return { sql: sql`${sql.id(tablename)} AS (${sql.join(selects, sql` UNION ALL `)})`, tablename }
	}
}
