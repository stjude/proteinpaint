/*
Per-request compute for termdbConfig.profileForms2Domains (Templates 2 picker map).
Invoked from termdb.config.ts with the request's auth context so the SQL can drop
parent_ids that the caller's role is not allowed to see (via tdb.getHiddenTermIds).
The result varies per user, so it is NOT cached dataset-wide.

Empty inner submaps signal "cohort declared but no template data".
*/
type Ctx = { clientAuthResult: any; activeCohort: string }

export function getProfileForms2Domains(ds: any, ctx: Ctx) {
	const tdb = ds.cohort?.termdb
	if (!tdb) return undefined
	if (!tdb.plotConfigByCohort || !ds.cohort?.db?.connection) return undefined

	const subtypeLabels: Record<string, string> = {}
	for (const cohortKey of Object.keys(tdb.plotConfigByCohort)) {
		const opts = tdb.plotConfigByCohort[cohortKey]?.profileForms2?.options
		if (!opts) continue
		for (const o of opts) if (o.subtype && o.name) subtypeLabels[o.subtype] = o.name
	}
	const subtypes = Object.keys(subtypeLabels)
	if (!subtypes.length) return undefined

	const hiddenIds: string[] = tdb.getHiddenTermIds?.(ctx) || []
	const placeholders = subtypes.map(() => '?').join(',')
	const hidPlaceholders = hiddenIds.length ? `AND s.term_id NOT IN (${hiddenIds.map(() => '?').join(',')})` : ''
	const sql = `SELECT DISTINCT s.cohort, t.parent_id, json_extract(t.jsondata, '$.subtype') AS subtype
		FROM terms t
		JOIN subcohort_terms s ON s.term_id = t.parent_id
		WHERE t.type='multivalue'
			AND json_extract(t.jsondata, '$.subtype') IN (${placeholders})
			AND t.parent_id IS NOT NULL
			${hidPlaceholders}`
	const rows = ds.cohort.db.connection.prepare(sql).all([...subtypes, ...hiddenIds])

	// Seed declared cohorts so an empty submap is distinguishable from a missing key.
	const out: Record<string, Record<string, string[]>> = {}
	for (const cohortKey of Object.keys(tdb.plotConfigByCohort)) {
		if (tdb.plotConfigByCohort[cohortKey]?.profileForms2?.options) out[cohortKey] = {}
	}
	for (const r of rows) {
		if (!out[r.cohort]) out[r.cohort] = {}
		const label = subtypeLabels[r.subtype]
		const arr = (out[r.cohort][r.parent_id] ||= [])
		if (!arr.includes(label)) arr.push(label)
	}
	return out
}
